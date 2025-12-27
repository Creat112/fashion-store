const express = require('express');
const router = express.Router();
const { getDB } = require('../database/init');

console.log('Order phone route loaded successfully');

// Get orders by phone number
router.get('/phone/:phone', (req, res) => {
    const { phone } = req.params;
    const db = getDB();

    console.log('=== PHONE SEARCH DEBUG ===');
    console.log('Searching for phone:', phone);
    console.log('Database available:', !!db);

    if (!phone) {
        console.log('No phone provided');
        return res.status(400).json({ error: 'Phone number is required' });
    }

    const query = `
        SELECT o.*, 
               JSON_GROUP_ARRAY(
                   JSON_OBJECT(
                       'productId', i.productId,
                       'quantity', i.quantity,
                       'price', i.price,
                       'productName', i.productName,
                       'colorId', i.colorId,
                       'colorName', i.colorName
                   )
               ) as items
        FROM orders o 
        LEFT JOIN order_items i ON o.id = i.orderId
        WHERE o.customerPhone = ?
        GROUP BY o.id
        ORDER BY o.date DESC
    `;

    console.log('Executing query:', query);
    console.log('With phone parameter:', phone);

    db.all(query, [phone], (err, rows) => {
        if (err) {
            console.error('Error fetching orders by phone:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        console.log('Query result rows:', rows.length);
        console.log('Raw rows:', JSON.stringify(rows, null, 2));

        // Parse items JSON for each order
        const orders = rows.map(row => {
            console.log(`Processing order ${row.orderNumber}:`);
            console.log(`Raw items field:`, row.items);
            console.log(`Items type:`, typeof row.items);
            
            try {
                let parsedItems = [];
                if (row.items) {
                    if (typeof row.items === 'string') {
                        parsedItems = JSON.parse(row.items);
                    } else if (Array.isArray(row.items)) {
                        parsedItems = row.items;
                    } else {
                        console.warn('Unexpected items format:', row.items);
                    }
                }
                
                console.log(`Parsed items for order ${row.orderNumber}:`, parsedItems);
                console.log(`Items count:`, parsedItems.length);
                
                return {
                    id: row.id,
                    orderNumber: row.orderNumber,
                    total: row.total,
                    status: row.status,
                    date: row.date,
                    customerName: row.customerName,
                    customerEmail: row.customerEmail,
                    customerPhone: row.customerPhone,
                    shippingAddress: row.shippingAddress,
                    shippingCity: row.shippingCity,
                    shippingGov: row.shippingGov,
                    notes: row.notes,
                    trackingNumber: row.trackingNumber,
                    estimatedDelivery: row.estimatedDelivery,
                    shippedDate: row.shippedDate,
                    deliveredDate: row.deliveredDate,
                    items: parsedItems
                };
            } catch (parseError) {
                console.error('Error parsing items for order:', row.id, parseError);
                return {
                    ...row,
                    items: []
                };
            }
        });

        console.log('Final orders array:', orders);
        res.json(orders);
    });
});

module.exports = router;
