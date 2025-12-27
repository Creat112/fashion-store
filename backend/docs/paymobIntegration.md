# Paymob Payment Integration

This document explains the complete Paymob payment integration for the SAVX store.

## Overview

Paymob is an Egyptian payment gateway that supports multiple payment methods including credit cards, wallet payments, and cash on delivery. This integration provides a secure and seamless payment experience for customers.

## Payment Flow

### 1. User Initiates Payment
- User clicks "Pay" button on checkout page
- Frontend sends payment request to backend

### 2. Backend Processes Payment
- Backend authenticates with Paymob using API Key
- Creates order in Paymob system
- Generates payment token for frontend

### 3. Frontend Redirects to Payment Page
- User is redirected to Paymob's secure payment page
- User selects payment method and completes payment

### 4. Paymob Callback
- Paymob sends webhook to backend with payment result
- Backend verifies payment status and updates database

### 5. Frontend Shows Result
- User is redirected to payment result page
- Frontend polls backend for final payment status
- Success or failure page is displayed

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Paymob Configuration
PAYMOB_API_KEY=your_api_key_here
PAYMOB_INTEGRATION_ID=your_integration_id_here
PAYMOB_IFRAME_ID=your_iframe_id_here
PAYMOB_HMAC_SECRET=your_hmac_secret_here
```

### Getting Paymob Credentials

1. **API Key**: From your Paymob dashboard under Settings → Account Settings
2. **Integration ID**: From Payment Integrations → Select Integration
3. **IFrame ID**: From Acceptance → Iframes
4. **HMAC Secret**: From Acceptance → Webhooks

## Implementation Files

### Backend Files

#### 1. Paymob Utils (`backend/utils/paymobUtils.js`)
Core Paymob integration functions:
- `authenticatePaymob()` - Get access token
- `createPaymobOrder()` - Create order in Paymob
- `generatePaymentKey()` - Generate payment token
- `getPaymentUrl()` - Get payment page URL
- `verifyWebhookSignature()` - Verify webhook security
- `processWebhook()` - Process webhook data

#### 2. Payment Routes (`backend/routes/payment.js`)
API endpoints for payment processing:
- `POST /api/payment/paymob/create` - Create payment session
- `POST /api/payment/paymob/webhook` - Paymob webhook callback
- `GET /api/payment/paymob/status/:orderId` - Check payment status

#### 3. Database Schema (`backend/database/init.js`)
Payment sessions table for tracking:
```sql
CREATE TABLE payment_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    paymob_order_id INTEGER,
    payment_token TEXT,
    amount REAL,
    status TEXT DEFAULT 'pending',
    transaction_id TEXT,
    created_at TEXT,
    processed_at TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id)
);
```

### Frontend Files

#### 1. Paymob JavaScript (`docs/assets/js/paymob.js`)
Frontend payment handling:
- `PaymobPayment` class
- Payment session creation
- Payment URL redirection
- Status polling
- Order data formatting

#### 2. Payment Result Page (`docs/payment-result.html`)
Page for showing payment results:
- Loading state during verification
- Success state with order details
- Error state with retry options
- Automatic status polling

## API Endpoints

### Create Payment Session
```http
POST /api/payment/paymob/create
Content-Type: application/json

{
    "amount": 1299.00,
    "orderId": 123,
    "customerData": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "phoneNumber": "+201234567890"
    },
    "shippingData": {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "phone_number": "+201234567890",
        "street": "123 Main St",
        "city": "Cairo",
        "country": "EG"
    },
    "items": [
        {
            "name": "Product Name",
            "price": 1299.00,
            "quantity": 1,
            "description": "Product description"
        }
    ]
}
```

**Response:**
```json
{
    "success": true,
    "paymentUrl": "https://accept.paymob.com/api/acceptance/iframes/12345?payment_token=token_here",
    "paymentToken": "token_here",
    "paymobOrderId": 789,
    "amount": 1299.00,
    "currency": "EGP"
}
```

### Payment Webhook
```http
POST /api/payment/paymob/webhook
Content-Type: application/json
X-Paymob-Hmac: hmac_signature_here

{
    "type": "TRANSACTION",
    "obj": {
        "id": 123456,
        "amount_cents": 129900,
        "success": true,
        "order": {
            "id": 789,
            "merchant_order_id": "123"
        },
        "created_at": "2024-01-01T12:00:00.000Z"
    },
    "hmac": "calculated_hmac_signature"
}
```

### Check Payment Status
```http
GET /api/payment/paymob/status/123
```

**Response:**
```json
{
    "orderId": 123,
    "status": "success",
    "transactionId": 123456,
    "orderStatus": "paid",
    "createdAt": "2024-01-01T12:00:00.000Z",
    "processedAt": "2024-01-01T12:05:00.000Z"
}
```

## Frontend Integration

### Basic Usage

```javascript
// Initialize Paymob payment
const paymob = new PaymobPayment();

// Process payment
async function processPayment(order, customer, items) {
    try {
        // Format order data
        const orderData = paymob.formatOrderData(order, customer, items);
        
        // Create payment session
        const session = await paymob.createPaymentSession(orderData);
        
        // Redirect to payment page
        paymob.redirectToPayment(session.paymentUrl);
        
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed: ' + error.message);
    }
}
```

### Payment Result Handling

The payment result page automatically:
1. Extracts order ID from URL parameters
2. Polls backend for payment status
3. Shows appropriate result page
4. Stores order information for tracking

## Security Considerations

### Webhook Security
- HMAC signature verification using Paymob secret
- Only process verified webhooks
- Log all webhook activities

### Data Protection
- Never store raw payment details
- Use HTTPS for all payment communications
- Validate all input data

### Error Handling
- Graceful failure handling
- User-friendly error messages
- Fallback payment options

## Testing

### Test Environment
Paymob provides test environment for development:
- Test cards and payment methods
- Sandbox API endpoints
- Test webhooks

### Test Cards
Use Paymob's test cards for testing:
- Visa: `4000 0000 0000 0002`
- Mastercard: `5555 5555 5555 4444`
- Any future date for expiry
- Any 3-digit CVV

### Testing Flow
1. Create test order
2. Process payment with test card
3. Verify webhook processing
4. Check payment status
5. Confirm order updates

## Production Deployment

### Environment Switch
Update URLs in `paymobUtils.js`:
```javascript
// Change from test to production URLs
AUTH_URL: 'https://egypt.paymob.com/api/auth/tokens',
ORDER_URL: 'https://egypt.paymob.com/api/ecommerce/orders',
PAYMENT_KEY_URL: 'https://egypt.paymob.com/api/acceptance/payment_keys',
IFRAME_URL: 'https://egypt.paymob.com/api/acceptance/iframes',
```

### Webhook Configuration
- Configure production webhook URL in Paymob dashboard
- Use HTTPS for webhook endpoint
- Test webhook connectivity

### Monitoring
- Monitor payment success rates
- Track webhook processing times
- Set up alerts for failures

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check API key validity
   - Verify environment URLs
   - Ensure proper credentials

2. **Payment Creation Failed**
   - Verify integration ID
   - Check order data format
   - Validate amount in cents

3. **Webhook Not Received**
   - Check webhook URL accessibility
   - Verify HMAC secret
   - Review Paymob webhook logs

4. **Payment Status Issues**
   - Check database connectivity
   - Verify order ID mapping
   - Review webhook processing

### Debug Mode
Enable debug logging:
```javascript
// In paymobUtils.js
console.log('Paymob request:', payload);
console.log('Paymob response:', response.data);
```

## Supported Payment Methods

Paymob supports various payment methods:
- Credit/Debit Cards (Visa, Mastercard, Meza)
- Mobile Wallets (Vodafone Cash, Etisalat Cash, Orange Money)
- Bank Installments
- Cash on Delivery (if enabled)

## Currency Support

Default currency is Egyptian Pound (EGP). For other currencies:
- Update currency configuration
- Verify Paymob support
- Adjust amount calculations

## Future Enhancements

Consider implementing:
- Multiple payment method selection
- Saved payment methods
- Subscription payments
- Refund processing
- Advanced analytics

## Support

For Paymob-specific issues:
- Paymob documentation: docs.paymob.com
- Paymob support: support@paymob.com
- Technical support: +20 120 000 0000
