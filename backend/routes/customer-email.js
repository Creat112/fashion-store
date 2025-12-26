const express = require('express');
const router = express.Router();
const { sendCustomerOrderEmailWithTracking } = require('../utils/email');

// Send customer order email
router.post('/send-order-email', async (req, res) => {
    try {
        const { orderData } = req.body;
        
        if (!orderData || !orderData.customer || !orderData.customer.email) {
            return res.status(400).json({ error: 'Missing order data or customer email' });
        }

        const result = await sendCustomerOrderEmailWithTracking(orderData);
        
        if (result) {
            res.json({ success: true, message: 'Customer email sent successfully' });
        } else {
            res.status(500).json({ error: 'Failed to send customer email' });
        }
    } catch (error) {
        console.error('Customer email API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
