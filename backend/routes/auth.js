const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');

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
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate password strength
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    try {
        const db = getDB();
        const createdAt = new Date().toISOString();
        const role = 'customer';

        // Hash the password
        const hashedPassword = await hashPassword(password);

        const stmt = db.prepare("INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)");
        stmt.run(name, email, hashedPassword, role, createdAt, function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID, name, email, role, createdAt });
        });
        stmt.finalize();
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const db = getDB();
        db.get("SELECT * FROM users WHERE email = ?", [email], async (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Handle Google auth users (they have 'GOOGLE_AUTH' as password)
            if (row.password === 'GOOGLE_AUTH') {
                return res.status(401).json({ error: 'Please use Google Sign-In for this account' });
            }

            // Compare the provided password with the hashed password
            const isMatch = await comparePassword(password, row.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Remove password from response
            const { password: _, ...user } = row;
            res.json(user);
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

module.exports = router;
