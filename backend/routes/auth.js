const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

const { OAuth2Client } = require('google-auth-library');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '633744806004-b1phb0vkuivleugtdrcmoumkior2sr31.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

// Google Sign-In
router.post('/google', async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, sub: googleId } = payload;

        const db = getDB();
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });

            if (row) {
                // User exists, log them in
                const { password: _, ...user } = row;
                res.json(user);
            } else {
                // Create new user (default role: customer)
                const createdAt = new Date().toISOString();
                const stmt = db.prepare("INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)");
                // We don't have a password for Google users, so we can store a placeholder or null if schema allows. 
                // Schema has password TEXT, not NOT NULL, so null might work if not strict, but let's put 'GOOGLE_AUTH'
                stmt.run(name, email, 'GOOGLE_AUTH', 'customer', createdAt, function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.status(201).json({ id: this.lastID, name, email, role: 'customer', createdAt });
                });
                stmt.finalize();
            }
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ error: 'Invalid Google Token' });
    }
});

// Signup
router.post('/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const db = getDB();
    const createdAt = new Date().toISOString();

    // Default role is customer. Admin must be set manually in DB.
    const role = 'customer';

    const stmt = db.prepare("INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)");
    stmt.run(name, email, password, role, createdAt, function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, name, email, role, createdAt });
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
        const { password: _, ...user } = row;
        res.json(user);
    });
});

module.exports = router;
