const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Get all products
router.get('/', (req, res) => {
    const { category } = req.query;
    const db = getDB();

    let query = "SELECT * FROM products WHERE disabled = 0";
    let params = [];

    if (category) {
        query += " AND category = ?";
        params.push(category);
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Get single product
router.get('/:id', (req, res) => {
    const db = getDB();
    db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(row);
    });
});

// Create Product
router.post('/', (req, res) => {
    const { name, price, description, category, image, stock } = req.body;
    const db = getDB();
    const stmt = db.prepare("INSERT INTO products (name, price, description, category, image, stock) VALUES (?, ?, ?, ?, ?, ?)");
    stmt.run(name, price, description, category, image, stock, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
    });
    stmt.finalize();
});

// Update Product
router.put('/:id', (req, res) => {
    const { name, price, description, category, image, stock, disabled } = req.body;
    const { id } = req.params;
    const db = getDB();

    // Build dynamic query
    let updates = [];
    let params = [];
    if (name) { updates.push("name = ?"); params.push(name); }
    if (price) { updates.push("price = ?"); params.push(price); }
    if (description) { updates.push("description = ?"); params.push(description); }
    if (category) { updates.push("category = ?"); params.push(category); }
    if (image) { updates.push("image = ?"); params.push(image); }
    if (stock !== undefined) { updates.push("stock = ?"); params.push(stock); }
    if (disabled !== undefined) { updates.push("disabled = ?"); params.push(disabled ? 1 : 0); }

    params.push(id);

    db.run(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Delete Product
router.delete('/:id', (req, res) => {
    const db = getDB();
    db.run("DELETE FROM products WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

module.exports = router;

