const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

// Signup
router.post('/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const db = getDB();
    const createdAt = new Date().toISOString();

    const stmt = db.prepare("INSERT INTO users (name, email, password, createdAt) VALUES (?, ?, ?, ?)");
    stmt.run(name, email, password, createdAt, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, name, email, createdAt });
    });
    stmt.finalize();
});

// Login
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const db = getDB();
    db.get("SELECT * FROM users WHERE email = ? AND password = ?", [email, password], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // In a real app, returning the password hash is bad. 
        // Here we just return the user info without the password for the frontend to store essentially as a session.
        const { password: _, ...user } = row;
        res.json(user);
    });
});

module.exports = router;
