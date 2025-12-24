const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Get cart API with color information
// In a real app, we would get the userId from the session/token.
// For now, let's assume the client sends a userId or we use a temporary session ID.
// To keep it simple for this local demo, let's just use a query param ?userId=1 (simulated).
router.get('/', (req, res) => {
    const { userId } = req.query; // client logic will need to handle this
    const db = getDB();

    // Join with products and product_colors to get details immediately
    const query = `
        SELECT c.*, p.name, p.price, p.image, p.discount, p.originalPrice,
               pc.colorName, pc.colorCode, pc.price as colorPrice, pc.stock as colorStock
        FROM cart c 
        JOIN products p ON c.productId = p.id
        LEFT JOIN product_colors pc ON c.colorId = pc.id
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

// Add to cart with stock validation
router.post('/', (req, res) => {
    const { productId, quantity, userId, colorId } = req.body;
    if (!productId || !userId) {
        return res.status(400).json({ error: 'ProductId and UserId required' });
    }

    if (!colorId) {
        return res.status(400).json({ error: 'ColorId is required. Please select a color.' });
    }

    const db = getDB();
    const addedAt = new Date().toISOString();

    // CRITICAL: Validate stock before adding to cart
    db.get("SELECT stock FROM product_colors WHERE id = ?", [colorId], (err, colorRow) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!colorRow) {
            return res.status(404).json({ error: 'Color variant not found' });
        }

        const requestedQty = quantity || 1;

        // Check if item exists for this user with same color
        db.get("SELECT * FROM cart WHERE userId = ? AND productId = ? AND colorId = ?", [userId, productId, colorId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            if (row) {
                // Update quantity - validate total against stock
                const newQty = row.quantity + requestedQty;

                if (newQty > colorRow.stock) {
                    return res.status(400).json({
                        error: `Insufficient stock. Only ${colorRow.stock} available, you're trying to add ${newQty} total.`,
                        availableStock: colorRow.stock
                    });
                }

                db.run("UPDATE cart SET quantity = ? WHERE id = ?", [newQty, row.id], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: 'Cart updated' });
                });
            } else {
                // Insert new - validate against stock
                if (requestedQty > colorRow.stock) {
                    return res.status(400).json({
                        error: `Insufficient stock. Only ${colorRow.stock} available.`,
                        availableStock: colorRow.stock
                    });
                }

                const stmt = db.prepare("INSERT INTO cart (userId, productId, quantity, colorId, addedAt) VALUES (?, ?, ?, ?, ?)");
                stmt.run(userId, productId, requestedQty, colorId, addedAt, (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: 'Item added to cart' });
                });
                stmt.finalize();
            }
        });
    });
});

// Update cart item with stock validation
router.put('/:id', (req, res) => {
    const { quantity } = req.body;
    const { id } = req.params;

    if (quantity < 1) {
        return res.status(400).json({ error: 'Quantity must be positive' });
    }

    const db = getDB();

    // Get cart item with color info to validate stock
    db.get("SELECT c.*, pc.stock FROM cart c LEFT JOIN product_colors pc ON c.colorId = pc.id WHERE c.id = ?", [id], (err, cartItem) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!cartItem) {
            return res.status(404).json({ error: 'Cart item not found' });
        }

        // Validate against stock
        if (cartItem.stock !== null && quantity > cartItem.stock) {
            return res.status(400).json({
                error: `Insufficient stock. Only ${cartItem.stock} available.`,
                availableStock: cartItem.stock
            });
        }

        db.run("UPDATE cart SET quantity = ? WHERE id = ?", [quantity, id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
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
