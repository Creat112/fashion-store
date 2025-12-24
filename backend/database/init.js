const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.VERCEL
    ? path.join('/tmp', 'fashion_store.db')
    : path.resolve(__dirname, 'fashion_store.db');
// Railway allows persistence on the disk, so we use the local path.
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
            role TEXT DEFAULT 'customer',
            createdAt TEXT
        )`, (err) => {
            if (!err) {
                // Check if name column exists (simple migration)
                db.run("ALTER TABLE users ADD COLUMN name TEXT", (err) => {
                    if (err && !err.message.includes("duplicate column name")) {
                        // Ignore if column already exists
                    }
                });
                // Check if role column exists (simple migration)
                db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'customer'", (err) => {
                    if (err && !err.message.includes("duplicate column name")) {
                        // Ignore if column already exists
                    }
                });
                seedAdmin();
            }
        });

        // Products Table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            description TEXT,
            category TEXT,
            image TEXT,
            stock INTEGER,
            disabled INTEGER DEFAULT 0,
            discount REAL DEFAULT 0,
            originalPrice REAL
        )`, (err) => {
            if (!err) {
                // Add new columns if they don't exist (migration)
                db.run("ALTER TABLE products ADD COLUMN discount REAL DEFAULT 0", (err) => {
                    if (err && !err.message.includes("duplicate column name")) {
                        console.error("Error adding discount column:", err.message);
                    }
                });
                db.run("ALTER TABLE products ADD COLUMN originalPrice REAL", (err) => {
                    if (err && !err.message.includes("duplicate column name")) {
                        console.error("Error adding originalPrice column:", err.message);
                    }
                });
                seedProducts();
            }
        });

        // Product Colors Table (for color variants with individual stock and pricing)
        db.run(`CREATE TABLE IF NOT EXISTS product_colors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            colorName TEXT,
            colorCode TEXT,
            price REAL,
            stock INTEGER,
            image TEXT,
            FOREIGN KEY(productId) REFERENCES products(id) ON DELETE CASCADE
        )`, (err) => {
            if (!err) {
                seedProductColors();
            }
        });

        // Cart Table
        db.run(`CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            productId INTEGER,
            quantity INTEGER,
            userId INTEGER,
            colorId INTEGER,
            addedAt TEXT,
            FOREIGN KEY(productId) REFERENCES products(id),
            FOREIGN KEY(colorId) REFERENCES product_colors(id)
        )`, (err) => {
            if (!err) {
                // Add colorId column if it doesn't exist (migration)
                db.run("ALTER TABLE cart ADD COLUMN colorId INTEGER", (err) => {
                    if (err && !err.message.includes("duplicate column name")) {
                        console.error("Error adding colorId column:", err.message);
                    }
                });
            }
        });

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
            colorId INTEGER,
            colorName TEXT,
            FOREIGN KEY(orderId) REFERENCES orders(id),
            FOREIGN KEY(colorId) REFERENCES product_colors(id)
        )`, (err) => {
            if (!err) {
                // Add color columns if they don't exist (migration)
                db.run("ALTER TABLE order_items ADD COLUMN colorId INTEGER", (err) => {
                    if (err && !err.message.includes("duplicate column name")) {
                        console.error("Error adding colorId column:", err.message);
                    }
                });
                db.run("ALTER TABLE order_items ADD COLUMN colorName TEXT", (err) => {
                    if (err && !err.message.includes("duplicate column name")) {
                        console.error("Error adding colorName column:", err.message);
                    }
                });
            }
        });
    });
};

const seedAdmin = () => {
    db.get("SELECT count(*) as count FROM users WHERE role = 'admin'", (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            console.log("Seeding admin user...");
            const admin = {
                name: 'Admin User',
                email: 'admin@fashion.com',
                password: 'admin123', // In real app, hash this!
                role: 'admin',
                createdAt: new Date().toISOString()
            };
            const stmt = db.prepare("INSERT INTO users (name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?)");
            stmt.run(admin.name, admin.email, admin.password, admin.role, admin.createdAt);
            stmt.finalize();
        }
    });
};

const seedProducts = () => {
    db.get("SELECT count(*) as count FROM products", (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            console.log("Seeding products...");
            const products = [
                { name: 'Modern Black Watch', price: 29.99, description: 'A modern black watch', category: 'watches', image: 'assets/images/1.jpg', stock: 50, discount: 0, originalPrice: null },
                { name: 'Blue Shoes', price: 47.99, description: 'Blue shoes', category: 'shoes', image: 'assets/images/2.jpg', stock: 30, discount: 20, originalPrice: 59.99 },
                { name: 'Red Shoes', price: 49.99, description: 'Red shoes', category: 'shoes', image: 'assets/images/3.jpg', stock: 25, discount: 0, originalPrice: null },
                { name: 'Black Shoes', price: 63.99, description: 'Black shoes', category: 'shoes', image: 'assets/images/4.jpg', stock: 40, discount: 20, originalPrice: 79.99 },
                { name: 'Black T-Shirt', price: 31.99, description: 'Black T-Shirt', category: 't-shirts', image: 'assets/images/5.jpg', stock: 35, discount: 20, originalPrice: 39.99 }
            ];

            const stmt = db.prepare("INSERT INTO products (name, price, description, category, image, stock, discount, originalPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            products.forEach(p => {
                stmt.run(p.name, p.price, p.description, p.category, p.image, p.stock, p.discount, p.originalPrice);
            });
            stmt.finalize();
        }
    });
};

const seedProductColors = () => {
    db.get("SELECT count(*) as count FROM product_colors", (err, row) => {
        if (err) return console.error(err.message);
        if (row.count === 0) {
            console.log("Seeding product colors...");
            const colors = [
                // Modern Black Watch (productId: 1)
                { productId: 1, colorName: 'Black', colorCode: '#000000', price: 29.99, stock: 30, image: 'assets/images/1.jpg' },
                { productId: 1, colorName: 'Silver', colorCode: '#C0C0C0', price: 34.99, stock: 20, image: 'assets/images/1.jpg' },

                // Blue Shoes (productId: 2) - with discount
                { productId: 2, colorName: 'Blue', colorCode: '#0066CC', price: 47.99, stock: 15, image: 'assets/images/2.jpg' },
                { productId: 2, colorName: 'Navy', colorCode: '#000080', price: 47.99, stock: 15, image: 'assets/images/2.jpg' },

                // Red Shoes (productId: 3)
                { productId: 3, colorName: 'Red', colorCode: '#FF0000', price: 49.99, stock: 25, image: 'assets/images/3.jpg' },

                // Black Shoes (productId: 4) - with discount
                { productId: 4, colorName: 'Black', colorCode: '#000000', price: 63.99, stock: 20, image: 'assets/images/4.jpg' },
                { productId: 4, colorName: 'Brown', colorCode: '#8B4513', price: 63.99, stock: 20, image: 'assets/images/4.jpg' },

                // Black T-Shirt (productId: 5) - with discount
                { productId: 5, colorName: 'Black', colorCode: '#000000', price: 31.99, stock: 15, image: 'assets/images/5.jpg' },
                { productId: 5, colorName: 'White', colorCode: '#FFFFFF', price: 31.99, stock: 10, image: 'assets/images/5.jpg' },
                { productId: 5, colorName: 'Gray', colorCode: '#808080', price: 31.99, stock: 10, image: 'assets/images/5.jpg' }
            ];

            const stmt = db.prepare("INSERT INTO product_colors (productId, colorName, colorCode, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)");
            colors.forEach(c => {
                stmt.run(c.productId, c.colorName, c.colorCode, c.price, c.stock, c.image);
            });
            stmt.finalize();
        }
    });
};

const getDB = () => db;

module.exports = { initDB, getDB };
