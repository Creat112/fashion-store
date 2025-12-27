/**
 * Paymob Payment Integration
 * Handles Paymob payment flow for SAVX store
 */

class PaymobPayment {
    constructor() {
        this.apiBaseUrl = window.location.origin + '/api/payment';
        this.isProcessing = false;
    }

    /**
     * Create Paymob payment session
     * @param {Object} orderData - Order information
     * @returns {Promise<Object>} - Payment session data
     */
    async createPaymentSession(orderData) {
        if (this.isProcessing) {
            throw new Error('Payment is already being processed');
        }

        this.isProcessing = true;

        try {
            const response = await fetch(`${this.apiBaseUrl}/paymob/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create payment session');
            }

            return data;
        } catch (error) {
            console.error('Paymob payment session creation error:', error);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Redirect to Paymob payment page
     * @param {string} paymentUrl - Paymob payment URL
     */
    redirectToPayment(paymentUrl) {
        // Open in same window for better user experience
        window.location.href = paymentUrl;
    }

    /**
     * Open payment in popup (alternative method)
     * @param {string} paymentUrl - Paymob payment URL
     * @returns {Promise<Object>} - Payment result
     */
    openPaymentPopup(paymentUrl) {
        return new Promise((resolve, reject) => {
            const popup = window.open(
                paymentUrl,
                'paymob-payment',
                'width=800,height=600,scrollbars=yes,resizable=yes'
            );

            if (!popup) {
                reject(new Error('Failed to open payment window. Please allow popups.'));
                return;
            }

            // Listen for popup close
            const checkClosed = setInterval(() => {
                if (popup.closed) {
                    clearInterval(checkClosed);
                    reject(new Error('Payment window was closed'));
                }
            }, 1000);

            // Listen for messages from popup
            const messageHandler = (event) => {
                if (event.origin !== window.location.origin) return;

                if (event.data.type === 'PAYMENT_RESULT') {
                    clearInterval(checkClosed);
                    window.removeEventListener('message', messageHandler);
                    popup.close();
                    resolve(event.data.result);
                }
            };

            window.addEventListener('message', messageHandler);
        });
    }

    /**
     * Check payment status
     * @param {number} orderId - Order ID
     * @returns {Promise<Object>} - Payment status
     */
    async checkPaymentStatus(orderId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/paymob/status/${orderId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to check payment status');
            }

            return data;
        } catch (error) {
            console.error('Payment status check error:', error);
            throw error;
        }
    }

    /**
     * Handle payment completion
     * @param {number} orderId - Order ID
     * @param {Function} onSuccess - Success callback
     * @param {Function} onError - Error callback
     */
    async handlePaymentCompletion(orderId, onSuccess, onError) {
        try {
            // Poll for payment status
            const maxAttempts = 30; // 5 minutes max
            let attempts = 0;

            const pollStatus = async () => {
                attempts++;
                
                try {
                    const status = await this.checkPaymentStatus(orderId);
                    
                    if (status.status === 'success') {
                        onSuccess(status);
                        return;
                    } else if (status.status === 'failed') {
                        onError(new Error('Payment failed'));
                        return;
                    }

                    // Continue polling if still pending
                    if (attempts < maxAttempts) {
                        setTimeout(pollStatus, 10000); // Check every 10 seconds
                    } else {
                        onError(new Error('Payment verification timeout'));
                    }
                } catch (error) {
                    if (attempts < maxAttempts) {
                        setTimeout(pollStatus, 10000);
                    } else {
                        onError(error);
                    }
                }
            };

            // Start polling
            setTimeout(pollStatus, 5000); // Start after 5 seconds

        } catch (error) {
            onError(error);
        }
    }

    /**
     * Format order data for Paymob
     * @param {Object} order - Order object
     * @param {Object} customer - Customer information
     * @param {Array} items - Order items
     * @returns {Object} - Formatted order data
     */
    formatOrderData(order, customer, items) {
        return {
            amount: order.total,
            orderId: order.id,
            customerData: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phoneNumber: customer.phone,
            },
            shippingData: {
                first_name: customer.firstName,
                last_name: customer.lastName,
                email: customer.email,
                phone_number: customer.phone,
                street: order.shippingAddress?.street || '',
                building: order.shippingAddress?.building || '',
                city: order.shippingAddress?.city || '',
                state: order.shippingAddress?.state || '',
                country: order.shippingAddress?.country || 'EG',
                postal_code: order.shippingAddress?.postalCode || '',
                apartment: order.shippingAddress?.apartment || '',
                floor: order.shippingAddress?.floor || '',
            },
            items: items.map(item => ({
                name: item.productName,
                price: item.price,
                quantity: item.quantity,
                description: `${item.colorName ? item.colorName + ' - ' : ''}${item.productName}`,
            })),
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaymobPayment;
} else {
    window.PaymobPayment = PaymobPayment;
}

/**
 * Usage Example:
 * 
 * const paymob = new PaymobPayment();
 * 
 * // Create payment and redirect
 * async function processPayment(order, customer, items) {
 *     try {
 *         const orderData = paymob.formatOrderData(order, customer, items);
 *         const session = await paymob.createPaymentSession(orderData);
 *         paymob.redirectToPayment(session.paymentUrl);
 *     } catch (error) {
 *         console.error('Payment error:', error);
 *         alert('Payment failed: ' + error.message);
 *     }
 * }
 * 
 * // Check payment status on return page
 * async function checkPaymentResult(orderId) {
 *     try {
 *         const status = await paymob.checkPaymentStatus(orderId);
 *         if (status.status === 'success') {
 *             // Show success page
 *         } else {
 *             // Show failure page
 *         }
 *     } catch (error) {
 *         console.error('Status check error:', error);
 *     }
 * }
 */
