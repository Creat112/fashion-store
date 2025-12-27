const express = require('express');
const router = express.Router();
const { 
    authenticatePaymob, 
    createPaymobOrder, 
    generatePaymentKey, 
    getPaymentUrl,
    verifyWebhookSignature,
    processWebhook 
} = require('../utils/paymobUtils');
const { getDB } = require('../database/init');
const { sendOrderEmail, sendCustomerOrderEmailWithTracking } = require('../utils/email');

// Paymob Payment Routes

/**
 * Create Paymob payment session
 * POST /api/payment/paymob/create
 */
router.post('/paymob/create', async (req, res) => {
    try {
        const { 
            amount, 
            orderId, 
            customerData, 
            shippingData,
            items = [] 
        } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        if (!orderId) {
            return res.status(400).json({ error: 'Order ID is required' });
        }

        // Convert amount to cents (Paymob expects amount in cents)
        const amountInCents = Math.round(amount * 100);

        // Step 1: Authenticate with Paymob
        const authToken = await authenticatePaymob();

        // Step 2: Create Paymob order
        const orderData = {
            merchantOrderId: orderId.toString(),
            items: items.map(item => ({
                name: item.name,
                amount_cents: Math.round(item.price * 100),
                description: item.description || '',
                quantity: item.quantity || 1,
            })),
            shippingData: shippingData || {},
        };

        const paymobOrder = await createPaymobOrder(authToken, amountInCents, orderData);

        // Step 3: Generate payment key
        const paymentData = {
            firstName: customerData?.firstName || shippingData?.first_name,
            lastName: customerData?.lastName || shippingData?.last_name,
            email: customerData?.email || shippingData?.email,
            phoneNumber: customerData?.phoneNumber || shippingData?.phone_number,
            street: shippingData?.street,
            building: shippingData?.building,
            city: shippingData?.city,
            state: shippingData?.state,
            country: shippingData?.country || 'EG',
            postalCode: shippingData?.postal_code,
            apartment: shippingData?.apartment,
            floor: shippingData?.floor,
        };

        const paymentToken = await generatePaymentKey(
            authToken, 
            paymobOrder.id, 
            amountInCents, 
            paymentData
        );

        // Step 4: Generate payment URL
        const paymentUrl = getPaymentUrl(paymentToken);

        // Store payment session info in database for tracking
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO payment_sessions 
            (order_id, paymob_order_id, payment_token, amount, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            orderId,
            paymobOrder.id,
            paymentToken,
            amount,
            'pending',
            new Date().toISOString()
        );
        stmt.finalize();

        res.json({
            success: true,
            paymentUrl,
            paymentToken,
            paymobOrderId: paymobOrder.id,
            amount,
            currency: 'EGP',
        });

    } catch (error) {
        console.error('Paymob payment creation error:', error);
        res.status(500).json({ 
            error: 'Payment processing failed',
            message: error.message 
        });
    }
});

/**
 * Paymob webhook callback
 * POST /api/payment/paymob/webhook
 */
router.post('/paymob/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    try {
        const webhookData = JSON.parse(req.body);
        const { hmac, obj, type } = webhookData;

        // Verify webhook signature
        if (!verifyWebhookSignature(obj, hmac)) {
            console.error('Invalid Paymob webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        // Process webhook data
        const processedData = processWebhook(webhookData);
        
        console.log('Paymob webhook received:', processedData);

        // Update payment status in database
        const db = getDB();
        
        if (type === 'TRANSACTION') {
            // Update payment session
            db.run(`
                UPDATE payment_sessions 
                SET status = ?, transaction_id = ?, processed_at = ?
                WHERE paymob_order_id = ?
            `, [
                processedData.status,
                processedData.transactionId,
                new Date().toISOString(),
                processedData.orderId
            ]);

            // Update order status if payment was successful
            if (processedData.status === 'success') {
                db.run(`
                    UPDATE orders 
                    SET status = 'paid', payment_method = 'paymob', updated_at = ?
                    WHERE id = ?
                `, [
                    new Date().toISOString(),
                    processedData.merchantOrderId
                ]);

                console.log(`Order ${processedData.merchantOrderId} paid successfully via Paymob`);

                // Send emails to admin and customer
                try {
                    // Get order details for email
                    db.get("SELECT * FROM orders WHERE id = ?", [processedData.merchantOrderId], async (err, orderRow) => {
                        if (!err && orderRow) {
                            // Send email to admin
                            await sendOrderEmail({
                                orderNumber: orderRow.orderNumber,
                                customer: {
                                    fullName: orderRow.customerName,
                                    email: orderRow.customerEmail,
                                    phone: orderRow.customerPhone
                                },
                                shipping: {
                                    address: orderRow.shippingAddress,
                                    city: orderRow.shippingCity,
                                    governorate: orderRow.shippingGov,
                                    notes: orderRow.notes
                                },
                                total: orderRow.total,
                                date: orderRow.date,
                                items: [] // Items would need to be fetched from order_items table
                            });

                            // Send email to customer
                            await sendCustomerOrderEmailWithTracking({
                                orderNumber: orderRow.orderNumber,
                                customer: {
                                    email: orderRow.customerEmail
                                },
                                total: orderRow.total,
                                date: orderRow.date
                            });

                            console.log('Emails sent for successful payment');
                        }
                    });
                } catch (emailError) {
                    console.error('Failed to send emails:', emailError);
                    // Don't fail the payment process if emails fail
                }
            } else {
                db.run(`
                    UPDATE orders 
                    SET status = 'payment_failed', updated_at = ?
                    WHERE id = ?
                `, [
                    new Date().toISOString(),
                    processedData.merchantOrderId
                ]);

                console.log(`Order ${processedData.merchantOrderId} payment failed via Paymob`);
            }
        }

        // Respond to Paymob
        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Paymob webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * Get payment status
 * GET /api/payment/paymob/status/:orderId
 */
router.get('/paymob/status/:orderId', (req, res) => {
    try {
        const { orderId } = req.params;
        const db = getDB();

        db.get(`
            SELECT ps.*, o.status as order_status 
            FROM payment_sessions ps
            LEFT JOIN orders o ON ps.order_id = o.id
            WHERE ps.order_id = ?
        `, [orderId], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (!row) {
                return res.status(404).json({ error: 'Payment session not found' });
            }

            res.json({
                orderId: row.order_id,
                status: row.status,
                transactionId: row.transaction_id,
                orderStatus: row.order_status,
                createdAt: row.created_at,
                processedAt: row.processed_at,
            });
        });

    } catch (error) {
        console.error('Payment status check error:', error);
        res.status(500).json({ error: 'Failed to check payment status' });
    }
});

module.exports = router;
