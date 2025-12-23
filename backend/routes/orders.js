const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Get all orders (Admin)
router.get('/', (req, res) => {
    const db = getDB();
    const query = `
        SELECT o.*, i.productId, i.quantity, i.price, i.productName 
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
                    name: row.productName
                });
            }
        });

        res.json(Array.from(ordersMap.values()));
    });
});

const { sendOrderEmail } = require('../utils/email');

// Create new order
router.post('/', (req, res) => {
    const { customer, shipping, items, total, orderNumber, date } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'No items in order' });
    }

    const db = getDB();

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

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
            const itemStmt = db.prepare(`INSERT INTO order_items (orderId, productId, quantity, price, productName) VALUES (?, ?, ?, ?, ?)`);
            const stockUpdateStmt = db.prepare(`
                UPDATE products 
                SET stock = stock - ?, 
                    disabled = CASE WHEN (stock - ?) <= 0 THEN 1 ELSE 0 END 
                WHERE id = ?
            `);

            items.forEach(item => {
                const productId = Number(item.productId || item.id);
                const qty = Number(item.quantity) || 0;
                const price = Number(item.price) || 0;
                const name = item.name || item.productName || 'Unknown Product';

                console.log(`Processing item: ${name} (ID: ${productId}), Qty: ${qty}`);

                itemStmt.run(orderId, productId, qty, price, name);
                stockUpdateStmt.run(qty, qty, productId, function (err) {
                    if (err) {
                        console.error(`Error updating stock for product ${productId}:`, err.message);
                    } else {
                        console.log(`Product ${productId} stock updated. Rows affected: ${this.changes}`);
                    }
                });
            });

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
        });
        stmt.finalize();
    });
});

// Update order status
router.put('/:id', (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    const db = getDB();
    db.run("UPDATE orders SET status = ? WHERE id = ? OR orderNumber = ?", [status, id, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
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
