const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Get all products with color variants
router.get('/', (req, res) => {
    const { category, includeDisabled } = req.query;
    const db = getDB();

    let query = "SELECT * FROM products WHERE 1=1";
    let params = [];

    // If includeDisabled is not true, only show enabled products
    if (includeDisabled !== 'true') {
        query += " AND disabled = 0";
    }

    if (category) {
        query += " AND category = ?";
        params.push(category);
    }

    db.all(query, params, (err, products) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Fetch colors for each product
        const productIds = products.map(p => p.id);
        if (productIds.length === 0) {
            return res.json([]);
        }

        const placeholders = productIds.map(() => '?').join(',');
        const colorQuery = `SELECT * FROM product_colors WHERE productId IN (${placeholders})`;

        db.all(colorQuery, productIds, (err, colors) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // Group colors by productId
            const colorsByProduct = {};
            colors.forEach(color => {
                if (!colorsByProduct[color.productId]) {
                    colorsByProduct[color.productId] = [];
                }
                colorsByProduct[color.productId].push(color);
            });

            // Attach colors to products
            const productsWithColors = products.map(product => ({
                ...product,
                colors: colorsByProduct[product.id] || []
            }));

            res.json(productsWithColors);
        });
    });
});

// Get single product with color variants
router.get('/:id', (req, res) => {
    const db = getDB();
    db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Fetch colors for this product
        db.all("SELECT * FROM product_colors WHERE productId = ?", [req.params.id], (err, colors) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json({
                ...product,
                colors: colors || []
            });
        });
    });
});

// Create Product with color variants
router.post('/', (req, res) => {
    const { name, price, description, category, image, stock, discount, originalPrice, colors } = req.body;
    const db = getDB();

    // Calculate originalPrice if discount is provided
    let finalOriginalPrice = originalPrice;
    let finalPrice = price;

    if (discount && discount > 0) {
        if (!originalPrice) {
            // If discount is set but no originalPrice, calculate it
            finalOriginalPrice = price;
            finalPrice = price * (1 - discount / 100);
        } else {
            finalOriginalPrice = originalPrice;
            finalPrice = price;
        }
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare("INSERT INTO products (name, price, description, category, image, stock, discount, originalPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        stmt.run(name, finalPrice, description, category, image, stock || 0, discount || 0, finalOriginalPrice, function (err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            const productId = this.lastID;

            // Insert colors if provided
            if (colors && Array.isArray(colors) && colors.length > 0) {
                const colorStmt = db.prepare("INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)");

                colors.forEach(color => {
                    colorStmt.run(
                        productId,
                        color.colorName,
                        color.colorCode,
                        color.price || finalPrice,
                        color.stock || 0,
                        color.image || image
                    );
                });

                colorStmt.finalize(() => {
                    db.run('COMMIT', (err) => {
                        if (err) {
                            console.error('Commit failed:', err.message);
                            return res.status(500).json({ error: err.message });
                        }
                        res.status(201).json({ id: productId });
                    });
                });
            } else {
                db.run('COMMIT', (err) => {
                    if (err) {
                        console.error('Commit failed:', err.message);
                        return res.status(500).json({ error: err.message });
                    }
                    res.status(201).json({ id: productId });
                });
            }
        });
        stmt.finalize();
    });
});

// Update Product with color variants
router.put('/:id', (req, res) => {
    const { name, price, description, category, image, stock, disabled, discount, originalPrice, colors } = req.body;
    const { id } = req.params;
    const db = getDB();

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // Build dynamic query for product update
        let updates = [];
        let params = [];
        if (name) { updates.push("name = ?"); params.push(name); }
        if (price !== undefined) { updates.push("price = ?"); params.push(price); }
        if (description) { updates.push("description = ?"); params.push(description); }
        if (category) { updates.push("category = ?"); params.push(category); }
        if (image && image.trim() !== '') { updates.push("image = ?"); params.push(image); }
        if (stock !== undefined) { updates.push("stock = ?"); params.push(stock); }
        if (disabled !== undefined) { updates.push("disabled = ?"); params.push(disabled ? 1 : 0); }
        if (discount !== undefined) { updates.push("discount = ?"); params.push(discount); }
        if (originalPrice !== undefined) { updates.push("originalPrice = ?"); params.push(originalPrice); }

        params.push(id);

        if (updates.length > 0) {
            db.run(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params, function (err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                // Update colors if provided
                if (colors && Array.isArray(colors)) {
                    // Delete existing colors
                    db.run("DELETE FROM product_colors WHERE productId = ?", [id], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: err.message });
                        }

                        // Insert new colors
                        if (colors.length > 0) {
                            const colorStmt = db.prepare("INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)");

                            colors.forEach(color => {
                                colorStmt.run(
                                    id,
                                    color.colorName,
                                    color.colorCode,
                                    color.price,
                                    color.stock || 0,
                                    color.image || image
                                );
                            });

                            colorStmt.finalize(() => {
                                db.run('COMMIT', (err) => {
                                    if (err) return res.status(500).json({ error: err.message });
                                    res.json({ success: true });
                                });
                            });
                        } else {
                            db.run('COMMIT', (err) => {
                                if (err) return res.status(500).json({ error: err.message });
                                res.json({ success: true });
                            });
                        }
                    });
                } else {
                    db.run('COMMIT', (err) => {
                        if (err) return res.status(500).json({ error: err.message });
                        res.json({ success: true });
                    });
                }
            });
        } else {
            db.run('ROLLBACK');
            res.json({ success: true });
        }
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

