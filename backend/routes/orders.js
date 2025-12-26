const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Get all orders (Admin)
router.get('/', (req, res) => {
    const db = getDB();
    const query = `
        SELECT o.*, i.productId, i.quantity, i.price, i.productName, i.colorId, i.colorName
        FROM orders o 
        LEFT JOIN order_items i ON o.id = i.orderId
        ORDER BY o.date DESC
    `;

    db.all(query, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Group items by order
        const ordersMap = new Map();
        rows.forEach(row => {
            if (!ordersMap.has(row.id)) {
                ordersMap.set(row.id, {
                    id: row.id,
                    orderNumber: row.orderNumber,
                    total: row.total,
                    status: row.status,
                    date: row.date,
                    customer: {
                        fullName: row.customerName,
                        email: row.customerEmail,
                        phone: row.customerPhone
                    },
                    shipping: {
                        address: row.shippingAddress,
                        city: row.shippingCity,
                        governorate: row.shippingGov,
                        notes: row.notes
                    },
                    items: []
                });
            }
            if (row.productId) {
                ordersMap.get(row.id).items.push({
                    productId: row.productId,
                    quantity: row.quantity,
                    price: row.price,
                    name: row.productName,
                    colorId: row.colorId,
                    colorName: row.colorName
                });
            }
        });

        res.json(Array.from(ordersMap.values()));
    });
});

const { sendOrderEmail, sendOrderStatusUpdateEmail } = require('../utils/email');

// Create new order with stock validation
router.post('/', (req, res) => {
    const { customer, shipping, items, total, orderNumber, date } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items in order' });
    }

    const db = getDB();

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // CRITICAL: Validate stock for all items BEFORE creating order
        const validateStock = () => {
            return new Promise((resolve, reject) => {
                let stockErrors = [];
                let completedChecks = 0;
                const totalChecks = items.length;

                if (totalChecks === 0) {
                    return resolve([]);
                }

                items.forEach((item, index) => {
                    const colorId = item.colorId;
                    const qty = Number(item.quantity) || 0;

                    if (!colorId) {
                        stockErrors.push(`Item ${index + 1} (${item.name}) is missing color selection`);
                        completedChecks++;
                        if (completedChecks === totalChecks) resolve(stockErrors);
                        return;
                    }

                    // Check stock synchronously in the transaction
                    db.get("SELECT stock FROM product_colors WHERE id = ?", [colorId], (err, colorRow) => {
                        if (err) {
                            stockErrors.push(`Error checking stock for ${item.name}: ${err.message}`);
                        } else if (!colorRow) {
                            stockErrors.push(`Color variant not found for ${item.name}`);
                        } else if (colorRow.stock < qty) {
                            stockErrors.push(`Insufficient stock for ${item.name}. Available: ${colorRow.stock}, Requested: ${qty}`);
                        }
                        
                        completedChecks++;
                        if (completedChecks === totalChecks) {
                            resolve(stockErrors);
                        }
                    });
                });
            });
        };

        validateStock().then(stockErrors => {
            if (stockErrors.length > 0) {
                db.run('ROLLBACK');
                return res.status(400).json({
                    error: 'Stock validation failed',
                    details: stockErrors
                });
            }

            // Proceed with order creation
            const stmt = db.prepare(`
                INSERT INTO orders (orderNumber, total, status, date, customerName, customerEmail, customerPhone, shippingAddress, shippingCity, shippingGov, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(orderNumber, total, 'pending', date, customer.fullName, customer.email, customer.phone, shipping.address, shipping.city, shipping.governorate, shipping.notes, function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                const orderId = this.lastID;
                const itemStmt = db.prepare(`INSERT INTO order_items (orderId, productId, quantity, price, productName, colorId, colorName) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                const stockUpdateStmt = db.prepare(`
                    UPDATE product_colors 
                    SET stock = stock - ? 
                    WHERE id = ? AND stock >= ?
                `);

                let itemsProcessed = 0;
                const totalItems = items.length;

                items.forEach(item => {
                    const productId = Number(item.productId || item.id);
                    const qty = Number(item.quantity) || 0;
                    const price = Number(item.price || item.colorPrice) || 0;
                    const name = item.name || item.productName || 'Unknown Product';
                    const colorId = item.colorId;
                    const colorName = item.colorName || '';

                    console.log(`Processing item: ${name} (ID: ${productId}), Color: ${colorName}, Qty: ${qty}`);

                    itemStmt.run(orderId, productId, qty, price, name, colorId, colorName);

                    // Update stock for the specific color variant
                    stockUpdateStmt.run(qty, colorId, qty, function (err) {
                        if (err) {
                            console.error(`Error updating stock for color ${colorId}:`, err.message);
                        } else if (this.changes === 0) {
                            console.warn(`Stock update failed for color ${colorId} - possible race condition`);
                        } else {
                            console.log(`Color ${colorId} stock updated. Rows affected: ${this.changes}`);
                        }
                        
                        itemsProcessed++;
                        if (itemsProcessed === totalItems) {
                            itemStmt.finalize(() => {
                                stockUpdateStmt.finalize(() => {
                                    db.run('COMMIT', (err) => {
                                        if (err) {
                                            console.error('Commit failed:', err.message);
                                            return res.status(500).json({ error: err.message });
                                        }
                                        console.log('Order and stock updates committed successfully.');

                                        // Send Email Notification (Async)
                                        sendOrderEmail({ customer, shipping, items, total, orderNumber, date })
                                            .then(success => {
                                                if (success) console.log('Admin notified via email.');
                                                else console.warn('Admin email notification failed.');
                                            });

                                        res.status(201).json({ success: true, orderId });
                                    });
                                });
                            });
                        }
                    });
                });
            });
            stmt.finalize();
        }).catch(err => {
            db.run('ROLLBACK');
            console.error('Stock validation error:', err);
            return res.status(500).json({ error: 'Stock validation failed', details: err.message });
        });
    });
});

// Track order by order number
router.get('/track/:orderNumber', (req, res) => {
    const { orderNumber } = req.params;
    const db = getDB();
    
    const query = `
        SELECT o.*, i.productId, i.quantity, i.price, i.productName, i.colorId, i.colorName,
               p.image as productImage
        FROM orders o 
        LEFT JOIN order_items i ON o.id = i.orderId
        LEFT JOIN products p ON i.productId = p.id
        WHERE o.orderNumber = ?
    `;

    db.get(query, [orderNumber], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Order not found' });

        // Get all items for this order
        const itemsQuery = `
            SELECT i.*, p.image as productImage
            FROM order_items i 
            LEFT JOIN products p ON i.productId = p.id
            WHERE i.orderId = ?
        `;
        
        db.all(itemsQuery, [row.id], (err, items) => {
            if (err) return res.status(500).json({ error: err.message });
            
            const order = {
                id: row.id,
                orderNumber: row.orderNumber,
                total: row.total,
                status: row.status,
                date: row.date,
                trackingNumber: row.trackingNumber,
                estimatedDelivery: row.estimatedDelivery,
                shippedDate: row.shippedDate,
                deliveredDate: row.deliveredDate,
                customer: {
                    fullName: row.customerName,
                    email: row.customerEmail,
                    phone: row.customerPhone
                },
                shipping: {
                    address: row.shippingAddress,
                    city: row.shippingCity,
                    governorate: row.shippingGov,
                    notes: row.notes
                },
                items: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    name: item.productName,
                    colorId: item.colorId,
                    colorName: item.colorName,
                    image: item.productImage || item.image
                }))
            };

            res.json(order);
        });
    });
});

// Update order status with tracking information
router.put('/:id', (req, res) => {
    const { status, trackingNumber, estimatedDelivery } = req.body;
    const { id } = req.params;
    const db = getDB();
    
    // First get the order details for email notification
    db.get("SELECT * FROM orders WHERE id = ? OR orderNumber = ?", [id, id], (err, order) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        
        // Build dynamic update query
        let updateFields = ['status = ?'];
        let updateValues = [status];
        
        if (trackingNumber !== undefined) {
            updateFields.push('trackingNumber = ?');
            updateValues.push(trackingNumber);
        }
        
        if (estimatedDelivery !== undefined) {
            updateFields.push('estimatedDelivery = ?');
            updateValues.push(estimatedDelivery);
        }
        
        // Add date fields based on status
        if (status === 'shipped') {
            updateFields.push('shippedDate = ?');
            updateValues.push(new Date().toISOString());
        } else if (status === 'delivered') {
            updateFields.push('deliveredDate = ?');
            updateValues.push(new Date().toISOString());
        }
        
        updateValues.push(id, id); // for WHERE clause
        
        const query = `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ? OR orderNumber = ?`;
        
        db.run(query, updateValues, async function (err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Send email notification to customer
            let emailSent = false;
            try {
                const orderData = {
                    orderNumber: order.orderNumber,
                    customerEmail: order.customerEmail,
                    date: order.date,
                    total: order.total
                };
                
                emailSent = await sendOrderStatusUpdateEmail(
                    orderData, 
                    status, 
                    trackingNumber, 
                    estimatedDelivery
                );
            } catch (emailError) {
                console.error('Error sending status update email:', emailError);
            }
            
            res.json({ 
                success: true, 
                changes: this.changes,
                message: `Order status updated to ${status}${emailSent ? ' and customer notified' : ''}`
            });
        });
    });
});

// Delete order
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Delete order items first
        // We need to find the internal ID if orderNumber was passed
        db.get("SELECT id FROM orders WHERE id = ? OR orderNumber = ?", [id, id], (err, row) => {
            if (err || !row) {
                db.run('ROLLBACK');
                return res.status(err ? 500 : 404).json({ error: err ? err.message : 'Order not found' });
            }

            const internalId = row.id;

            db.run('DELETE FROM order_items WHERE orderId = ?', [internalId], (err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                // Delete the order
                db.run('DELETE FROM orders WHERE id = ?', [internalId], function (err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }

                    db.run('COMMIT', (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ success: true });
                    });
                });
            });
        });
    });
});

module.exports = router;
