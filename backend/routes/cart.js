const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Get cart API
// In a real app, we would get the userId from the session/token.
// For now, let's assume the client sends a userId or we use a temporary session ID.
// To keep it simple for this local demo, let's just use a query param ?userId=1 (simulated).
router.get('/', (req, res) => {
    const { userId } = req.query; // client logic will need to handle this
    const db = getDB();

    // We'll join with products to get details immediately
    const query = `
        SELECT c.*, p.name, p.price, p.image 
        FROM cart c 
        JOIN products p ON c.productId = p.id
        WHERE c.userId = ?
    `;

    if (!userId) {
        // Return empty if no user (or we could handle guest cart logic differently)
        return res.json([]);
    }

    db.all(query, [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Add to cart
router.post('/', (req, res) => {
    const { productId, quantity, userId } = req.body;
    if (!productId || !userId) {
        return res.status(400).json({ error: 'ProductId and UserId required' });
    }

    const db = getDB();
    const addedAt = new Date().toISOString();

    // Check if item exists for this user
    db.get("SELECT * FROM cart WHERE userId = ? AND productId = ?", [userId, productId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            // Update quantity
            const newQty = row.quantity + (quantity || 1);
            db.run("UPDATE cart SET quantity = ? WHERE id = ?", [newQty, row.id], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Cart updated' });
            });
        } else {
            // Insert new
            const stmt = db.prepare("INSERT INTO cart (userId, productId, quantity, addedAt) VALUES (?, ?, ?, ?)");
            stmt.run(userId, productId, quantity || 1, addedAt, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Item added to cart' });
            });
            stmt.finalize();
        }
    });
});

// Update cart item
router.put('/:id', (req, res) => {
    const { quantity } = req.body;
    const { id } = req.params;

    if (quantity < 1) {
        return res.status(400).json({ error: 'Quantity must be positive' });
    }

    const db = getDB();
    db.run("UPDATE cart SET quantity = ? WHERE id = ?", [quantity, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Remove item
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    db.run("DELETE FROM cart WHERE id = ?", [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Clear cart
router.delete('/', (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'UserId required' });

    const db = getDB();
    db.run("DELETE FROM cart WHERE userId = ?", [userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

module.exports = router;
