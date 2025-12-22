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

            items.forEach(item => {
                itemStmt.run(orderId, item.productId || item.id, item.quantity, item.price, item.name);
            });

            itemStmt.finalize(() => {
                db.run('COMMIT', (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.status(201).json({ success: true, orderId });
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

module.exports = router;
