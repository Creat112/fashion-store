const axios = require('axios');
// const MockPaymobService = require('./mockPaymob'); // TEST MODE - COMMENTED OUT

// Paymob configuration
const PAYMOB_CONFIG = {
    // Test environment URLs
    AUTH_URL: 'https://accept.paymob.com/api/auth/tokens',
    ORDER_URL: 'https://accept.paymob.com/api/ecommerce/orders',
    PAYMENT_KEY_URL: 'https://accept.paymob.com/api/acceptance/payment_keys',
    IFRAME_URL: 'https://accept.paymob.com/api/acceptance/iframes',
    
    // Production URLs (uncomment for production)
    // AUTH_URL: 'https://egypt.paymob.com/api/auth/tokens',
    // ORDER_URL: 'https://egypt.paymob.com/api/ecommerce/orders',
    // PAYMENT_KEY_URL: 'https://egypt.paymob.com/api/acceptance/payment_keys',
    // IFRAME_URL: 'https://egypt.paymob.com/api/acceptance/iframes',
    
    API_KEY: process.env.PAYMOB_API_KEY,
    INTEGRATION_ID: process.env.PAYMOB_INTEGRATION_ID,
    IFRAME_ID: process.env.PAYMOB_IFRAME_ID,
    
    // Currency configuration
    CURRENCY: 'EGP', // Egyptian Pound
};

// Initialize mock service for testing
// const mockService = new MockPaymobService(); // TEST MODE - COMMENTED OUT
// const isTestMode = !PAYMOB_CONFIG.API_KEY || process.env.NODE_ENV === 'development'; // TEST MODE - COMMENTED OUT

/**
 * Authenticate with Paymob and get access token
 * @returns {Promise<string>} - Access token
 */
const authenticatePaymob = async () => {
    // TEST MODE CODE COMMENTED OUT
    // if (isTestMode) {
    //     console.log('Using mock Paymob authentication');
    //     const result = await mockService.authenticate();
    //     return result.token;
    // }

    try {
        const response = await axios.post(PAYMOB_CONFIG.AUTH_URL, {
            api_key: PAYMOB_CONFIG.API_KEY,
        });
        
        return response.data.token;
    } catch (error) {
        console.error('Paymob authentication error:', error.response?.data || error.message);
        throw new Error('Failed to authenticate with Paymob');
    }
};

/**
 * Create an order in Paymob
 * @param {string} authToken - Paymob access token
 * @param {number} amount - Order amount in cents
 * @param {Object} orderData - Additional order data
 * @returns {Promise<Object>} - Order response
 */
const createPaymobOrder = async (authToken, amount, orderData = {}) => {
    // TEST MODE CODE COMMENTED OUT
    // if (isTestMode) {
    //     console.log('Using mock Paymob order creation');
    //     return await mockService.createOrder(authToken, amount, orderData);
    // }

    try {
        const payload = {
            auth_token: authToken,
            delivery_needed: false,
            amount_cents: amount,
            currency: PAYMOB_CONFIG.CURRENCY,
            merchant_order_id: orderData.merchantOrderId || null,
            items: orderData.items || [],
            shipping_data: orderData.shippingData || {},
            shipping_details: orderData.shippingDetails || null,
        };

        const response = await axios.post(PAYMOB_CONFIG.ORDER_URL, payload);
        return response.data;
    } catch (error) {
        console.error('Paymob order creation error:', error.response?.data || error.message);
        throw new Error('Failed to create Paymob order');
    }
};

/**
 * Generate payment key for frontend
 * @param {string} authToken - Paymob access token
 * @param {number} orderId - Paymob order ID
 * @param {number} amount - Order amount in cents
 * @param {Object} paymentData - Payment configuration data
 * @returns {Promise<string>} - Payment token
 */
const generatePaymentKey = async (authToken, orderId, amount, paymentData = {}) => {
    try {
        const payload = {
            auth_token: authToken,
            amount_cents: amount,
            expiration: paymentData.expiration || 3600, // 1 hour default
            order_id: orderId,
            billing_data: {
                first_name: paymentData.firstName || 'NA',
                last_name: paymentData.lastName || 'NA',
                email: paymentData.email || 'NA',
                phone_number: paymentData.phoneNumber || 'NA',
                apartment: paymentData.apartment || 'NA',
                floor: paymentData.floor || 'NA',
                street: paymentData.street || 'NA',
                building: paymentData.building || 'NA',
                city: paymentData.city || 'NA',
                country: paymentData.country || 'EG',
                state: paymentData.state || 'NA',
                postal_code: paymentData.postalCode || 'NA',
            },
            currency: PAYMOB_CONFIG.CURRENCY,
            integration_id: PAYMOB_CONFIG.INTEGRATION_ID,
            lock_order_when_paid: paymentData.lockOrder !== false,
        };

        const response = await axios.post(PAYMOB_CONFIG.PAYMENT_KEY_URL, payload);
        return response.data.token;
    } catch (error) {
        console.error('Paymob payment key generation error:', error.response?.data || error.message);
        throw new Error('Failed to generate payment key');
    }
};

/**
 * Get payment iframe URL
 * @param {string} paymentToken - Payment token
 * @returns {string} - Iframe URL
 */
const getPaymentUrl = (paymentToken) => {
    return `${PAYMOB_CONFIG.IFRAME_URL}/${PAYMOB_CONFIG.IFRAME_ID}?payment_token=${paymentToken}`;
};

/**
 * Verify Paymob webhook signature
 * @param {Object} payload - Webhook payload
 * @param {string} signature - HMAC signature from webhook
 * @returns {boolean} - Whether signature is valid
 */
const verifyWebhookSignature = (payload, signature) => {
    const crypto = require('crypto');
    const secret = process.env.PAYMOB_HMAC_SECRET;
    
    if (!secret) {
        console.warn('Paymob HMAC secret not configured');
        return false;
    }
    
    const calculatedSignature = crypto
        .createHmac('sha512', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    
    return calculatedSignature === signature;
};

/**
 * Process Paymob webhook
 * @param {Object} webhookData - Webhook data
 * @returns {Object} - Processed webhook result
 */
const processWebhook = (webhookData) => {
    const { obj } = webhookData;
    
    return {
        transactionId: obj.id,
        orderId: obj.order?.id,
        amount: obj.amount_cents,
        currency: obj.currency,
        status: obj.success ? 'success' : 'failed',
        paymentMethod: obj.source_data?.type || 'unknown',
        transactionDate: obj.created_at,
        hmacSignature: webhookData.hmac,
        merchantOrderId: obj.order?.merchant_order_id,
    };
};

module.exports = {
    authenticatePaymob,
    createPaymobOrder,
    generatePaymentKey,
    getPaymentUrl,
    verifyWebhookSignature,
    processWebhook,
    PAYMOB_CONFIG,
};
