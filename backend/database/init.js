const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'fashion_store.db');
let db;

const initDB = () => {
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error opening database', err.message);
        } else {
            console.log('Connected to the SQLite database.');
            createTables();
        }
    });
};

const createTables = () => {
    db.serialize(() => {
        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            createdAt TEXT
        )`);

        // Products Table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            description TEXT,
            category TEXT,
            image TEXT,
            stock INTEGER,
            disabled INTEGER DEFAULT 0
        )`, (err) => {
            if (!err) {
                seedProducts();
            }
        });

        // Cart Table
        db.run(`CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            quantity INTEGER,
            userId INTEGER,
            addedAt TEXT,
            FOREIGN KEY(productId) REFERENCES products(id)
        )`);

        // Orders Table
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orderNumber TEXT UNIQUE,
            total REAL,
            status TEXT DEFAULT 'pending',
            date TEXT,
            customerName TEXT,
            customerEmail TEXT,
            customerPhone TEXT,
            shippingAddress TEXT,
            shippingCity TEXT,
            shippingGov TEXT,
            notes TEXT
        )`);

        // Order Items Table
        db.run(`CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orderId INTEGER,
            productId INTEGER,
            quantity INTEGER,
            price REAL,
            productName TEXT,
            FOREIGN KEY(orderId) REFERENCES orders(id)
        )`);
    });
};

const seedProducts = () => {
    db.get("SELECT count(*) as count FROM products", (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            console.log("Seeding products...");
            const products = [
                { name: 'Modern Black Watch', price: 29.99, description: 'A modern black watch', category: 'watches', image: 'assets/images/1.jpg', stock: 50 },
                { name: 'Blue Shoes', price: 59.99, description: 'Blue shoes', category: 'shoes', image: 'assets/images/2.jpg', stock: 30 },
                { name: 'Red Shoes', price: 49.99, description: 'Red shoes', category: 'shoes', image: 'assets/images/3.jpg', stock: 25 },
                { name: 'Black Shoes', price: 79.99, description: 'Black shoes', category: 'shoes', image: 'assets/images/4.jpg', stock: 40 },
                { name: 'Black T-Shirt', price: 39.99, description: 'Black T-Shirt', category: 't-shirts', image: 'assets/images/5.jpg', stock: 35 }
            ];

            const stmt = db.prepare("INSERT INTO products (name, price, description, category, image, stock) VALUES (?, ?, ?, ?, ?, ?)");
            products.forEach(p => {
                stmt.run(p.name, p.price, p.description, p.category, p.image, p.stock);
            });
            stmt.finalize();
        }
    });
};

const getDB = () => db;

module.exports = { initDB, getDB };
