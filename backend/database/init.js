const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.VERCEL
    ? path.join('/tmp', 'SAVX_store.db')
    : path.resolve(__dirname, 'SAVX_store.db');
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
                email: 'admin@SAVX.com',
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
                { 
                    name: 'Winter Compression', 
                    price: 390, 
                    originalPrice: 450,
                    description: 'Comfortable winter compression wear', 
                    category: 'compression', 
                    image: 'products/Winter Compression/Black Compression.jpeg', 
                    stock: 50, 
                    discount: 13.33
                },
                { 
                    name: 'Sweat Pants', 
                    price: 580, 
                    originalPrice: 690,
                    description: 'Comfortable sweat pants for daily wear', 
                    category: 'pants', 
                    image: 'products/sweetpants/Sweet Pants Black.jpeg', 
                    stock: 30, 
                    discount: 15.94
                },
                { 
                    name: 'Zipper Jacket', 
                    price: 690, 
                    originalPrice: 1010,
                    description: 'Stylish zipper jacket with modern design', 
                    category: 'jackets', 
                    image: 'products/Ziper Jacket/Ziper Jacket Black.jpeg', 
                    stock: 25, 
                    discount: 31.68
                },
                { 
                    name: 'Savax Winter Set', 
                    price: 1300, 
                    originalPrice: 1750,
                    description: 'Complete set with top and bottom', 
                    category: 'sets', 
                    image: 'products/Set/Sets Savax Black.jpeg', 
                    stock: 20, 
                    discount: 25.71
                }
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
                // Winter Compression (productId: 1)
                { productId: 1, colorName: 'Black', colorCode: '#000000', price: 390, stock: 25, image: 'products/Winter Compression/Black Compression.jpeg' },
                { productId: 1, colorName: 'White', colorCode: '#FFFFFF', price: 390, stock: 25, image: 'products/Winter Compression/White Compression.jpeg' },

                // Sweat Pants (productId: 2)
                { productId: 2, colorName: 'Black', colorCode: '#000000', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Black.jpeg' },
                { productId: 2, colorName: 'Brown', colorCode: '#8B4513', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Brown.jpeg' },
                { productId: 2, colorName: 'Grey', colorCode: '#808080', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Grey.jpeg' },
                { productId: 2, colorName: 'Olive Green', colorCode: '#808000', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Olive Green.jpeg' },
                { productId: 2, colorName: 'Pink', colorCode: '#FFC0CB', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants Pink.jpeg' },
                { productId: 2, colorName: 'White', colorCode: '#FFFFFF', price: 580, stock: 10, image: 'products/sweetpants/Sweet Pants white.jpeg' },

                // Zipper Jacket (productId: 3)
                { productId: 3, colorName: 'Black', colorCode: '#000000', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Black.jpeg' },
                { productId: 3, colorName: 'Olive Green', colorCode: '#808000', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Olive Greenjpeg.jpeg' },
                { productId: 3, colorName: 'Pink', colorCode: '#FFC0CB', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket Pink.jpeg' },
                { productId: 3, colorName: 'White', colorCode: '#FFFFFF', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket White.jpeg' },
                { productId: 3, colorName: 'Brown', colorCode: '#8B4513', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket brownjpeg.jpeg' },
                { productId: 3, colorName: 'Grey', colorCode: '#808080', price: 690, stock: 8, image: 'products/Ziper Jacket/Ziper Jacket greyjpeg.jpeg' },

                // Set (productId: 4)
                { productId: 4, colorName: 'Black', colorCode: '#000000', price: 1300, stock: 5, image: 'products/Set/Sets Savax Black.jpeg' },
                { productId: 4, colorName: 'Brown', colorCode: '#8B4513', price: 1300, stock: 5, image: 'products/Set/Sets Savax Brown.jpeg' },
                { productId: 4, colorName: 'Grey', colorCode: '#808080', price: 1300, stock: 5, image: 'products/Set/Sets Savax Grey.jpeg' },
                { productId: 4, colorName: 'Olive Green', colorCode: '#808000', price: 1300, stock: 5, image: 'products/Set/Sets Savax Olive Green.jpeg' },
                { productId: 4, colorName: 'Pink', colorCode: '#FFC0CB', price: 1300, stock: 5, image: 'products/Set/Sets Savax Pink.jpeg' },
                { productId: 4, colorName: 'White', colorCode: '#FFFFFF', price: 1300, stock: 5, image: 'products/Set/Sets Savax White.jpeg' }
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
