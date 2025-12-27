/**
 * Mock Paymob Service for Testing
 * Simulates Paymob API responses without real credentials
 */

class MockPaymobService {
    constructor() {
        this.isTestMode = !process.env.PAYMOB_API_KEY || process.env.NODE_ENV === 'development';
    }

    /**
     * Mock authentication - always returns a fake token
     */
    async authenticate() {
        if (!this.isTestMode) {
            throw new Error('Real Paymob API not available in mock service');
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            token: 'mock_token_' + Date.now(),
            expires_in: 3600
        };
    }

    /**
     * Mock order creation
     */
    async createOrder(authToken, amount, orderData) {
        if (!this.isTestMode) {
            throw new Error('Real Paymob API not available in mock service');
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        return {
            id: Math.floor(100000 + Math.random() * 900000),
            created_at: new Date().toISOString(),
            amount_cents: amount,
            currency: 'EGP',
            order: {
                merchant_order_id: orderData.merchantOrderId
            }
        };
    }

    /**
     * Mock payment key generation
     */
    async generatePaymentKey(authToken, orderId, amount, paymentData) {
        if (!this.isTestMode) {
            throw new Error('Real Paymob API not available in mock service');
        }

        await new Promise(resolve => setTimeout(resolve, 400));

        return {
            token: 'mock_payment_token_' + Date.now(),
            iframe_id: process.env.PAYMOB_IFRAME_ID || '123456'
        };
    }

    /**
     * Mock payment URL generation
     */
    getPaymentUrl(paymentToken) {
        // Return a local test page instead of real Paymob URL
        return `http://localhost:3000/mock-payment.html?token=${paymentToken}`;
    }

    /**
     * Mock webhook processing
     */
    async processWebhook(webhookData) {
        if (!this.isTestMode) {
            throw new Error('Real Paymob API not available in mock service');
        }

        // Simulate successful payment after 3 seconds
        setTimeout(() => {
            this.triggerMockWebhook(webhookData.obj.order?.merchant_order_id);
        }, 3000);

        return {
            received: true
        };
    }

    /**
     * Trigger mock webhook for testing
     */
    async triggerMockWebhook(orderId) {
        const mockWebhookData = {
            type: 'TRANSACTION',
            obj: {
                id: Math.floor(1000000 + Math.random() * 9000000),
                amount_cents: 129900,
                success: true,
                order: {
                    id: Math.floor(100000 + Math.random() * 900000),
                    merchant_order_id: orderId
                },
                created_at: new Date().toISOString()
            },
            hmac: 'mock_hmac_signature'
        };

        // This would normally be called by Paymob, but we're simulating it
        console.log('Mock webhook triggered:', mockWebhookData);
        
        // You can manually call your webhook endpoint with this data
        // or integrate this with your test runner
    }
}

module.exports = MockPaymobService;
