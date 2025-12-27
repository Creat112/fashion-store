# Paymob Payment Testing Guide

This guide explains how to test the Paymob payment integration end-to-end.

## Prerequisites

1. **Paymob Account**: Create an account at [paymob.com](https://paymob.com)
2. **Test Credentials**: Get test API keys from Paymob dashboard
3. **Environment Setup**: Configure test environment variables

## Step 1: Configure Test Environment

### Environment Variables
Add these to your `.env` file:

```env
# Paymob Test Configuration
PAYMOB_API_KEY=your_test_api_key
PAYMOB_INTEGRATION_ID=your_test_integration_id
PAYMOB_IFRAME_ID=your_test_iframe_id
PAYMOB_HMAC_SECRET=your_test_hmac_secret
```

### Getting Test Credentials

1. Login to Paymob Dashboard
2. Go to **Settings** → **Account Settings**
3. Copy **API Key** (test environment)
4. Go to **Payment Integrations**
5. Select or create an integration
6. Copy **Integration ID**
7. Go to **Acceptance** → **Iframes**
8. Copy **IFrame ID**
9. Go to **Acceptance** → **Webhooks**
10. Copy **HMAC Secret**

## Step 2: Install Dependencies

```bash
npm install axios
```

## Step 3: Test Payment Flow

### Method 1: Using Browser (Recommended)

1. **Start the application**:
```bash
npm start
```

2. **Add products to cart**:
   - Go to `http://localhost:3000/products.html`
   - Add items to cart
   - Proceed to checkout

3. **Fill checkout form**:
   - Enter customer details
   - Enter shipping address
   - Select Paymob as payment method

4. **Process payment**:
   - Click "Pay with Paymob"
   - You'll be redirected to Paymob's test payment page

5. **Use test card details**:
```
Card Number: 4000 0000 0000 0002 (Visa)
or 5555 5555 5555 4444 (Mastercard)
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits (e.g., 123)
Cardholder Name: Test User
```

6. **Complete payment**:
   - Click "Pay" or "Confirm"
   - Wait for processing
   - You'll be redirected to payment result page

### Method 2: Using API Testing

#### Test Payment Creation
```bash
curl -X POST http://localhost:3000/api/payment/paymob/create \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "orderId": "test-123",
    "customerData": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com",
      "phoneNumber": "+201234567890"
    },
    "shippingData": {
      "first_name": "Test",
      "last_name": "User",
      "email": "test@example.com",
      "phone_number": "+201234567890",
      "street": "123 Test St",
      "city": "Cairo",
      "country": "EG"
    },
    "items": [
      {
        "name": "Test Product",
        "price": 100.00,
        "quantity": 1,
        "description": "Test product description"
      }
    ]
  }'
```

#### Expected Response
```json
{
  "success": true,
  "paymentUrl": "https://accept.paymob.com/api/acceptance/iframes/12345?payment_token=token_here",
  "paymentToken": "token_here",
  "paymobOrderId": 789,
  "amount": 100.00,
  "currency": "EGP"
}
```

## Step 4: Test Webhook

### Using ngrok for Local Testing

1. **Install ngrok**:
```bash
npm install -g ngrok
```

2. **Start ngrok**:
```bash
ngrok http 3000
```

3. **Copy ngrok URL** (e.g., `https://abc123.ngrok.io`)

4. **Configure Paymob webhook**:
   - Go to Paymob Dashboard → Acceptance → Webhooks
   - Add webhook URL: `https://abc123.ngrok.io/api/payment/paymob/webhook`
   - Select "TRANSACTION" event type
   - Save configuration

### Simulate Webhook

You can simulate a webhook using curl:

```bash
curl -X POST http://localhost:3000/api/payment/paymob/webhook \
  -H "Content-Type: application/json" \
  -H "X-Paymob-Hmac: test_hmac_signature" \
  -d '{
    "type": "TRANSACTION",
    "obj": {
      "id": 123456,
      "amount_cents": 10000,
      "success": true,
      "order": {
        "id": 789,
        "merchant_order_id": "test-123"
      },
      "created_at": "2024-01-01T12:00:00.000Z"
    },
    "hmac": "calculated_hmac_signature"
  }'
```

## Step 5: Test Payment Status

### Check Status via API
```bash
curl http://localhost:3000/api/payment/paymob/status/test-123
```

### Expected Response
```json
{
  "orderId": "test-123",
  "status": "success",
  "transactionId": 123456,
  "orderStatus": "paid",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "processedAt": "2024-01-01T12:05:00.000Z"
}
```

## Step 6: Test Payment Result Page

1. **Access result page**:
```
http://localhost:3000/payment-result.html?order_id=test-123
```

2. **Verify status display**:
   - Loading state should appear first
   - Success or error state should show after polling
   - Order details should be displayed for successful payments

## Test Scenarios

### Scenario 1: Successful Payment
1. Create order with valid data
2. Use valid test card
3. Complete payment
4. Verify webhook processing
5. Check order status update

### Scenario 2: Failed Payment
1. Create order
2. Use invalid test card (e.g., `4000 0000 0000 0002` with wrong CVV)
3. Verify failure handling
4. Check error message display

### Scenario 3: Cancelled Payment
1. Create order
2. Start payment process
3. Close payment window or cancel
4. Verify cancellation handling

### Scenario 4: Network Issues
1. Test with slow network
2. Test webhook retry logic
3. Verify timeout handling

## Common Test Issues & Solutions

### Issue 1: "Invalid API Key"
**Solution**: Verify you're using test environment keys, not production keys

### Issue 2: "Webhook not received"
**Solution**: 
- Check ngrok is running
- Verify webhook URL in Paymob dashboard
- Check firewall settings

### Issue 3: "Payment page not loading"
**Solution**:
- Verify integration ID is correct
- Check IFrame ID is valid
- Ensure payment token is generated

### Issue 4: "Status always pending"
**Solution**:
- Check webhook processing
- Verify database updates
- Check polling logic

## Debugging Tips

### Enable Debug Logging
Add this to `paymobUtils.js`:
```javascript
// At the top of the file
const DEBUG = process.env.NODE_ENV !== 'production';

// Add logging to functions
if (DEBUG) {
    console.log('Paymob Request:', payload);
    console.log('Paymob Response:', response.data);
}
```

### Check Database
```sql
-- Check payment sessions
SELECT * FROM payment_sessions;

-- Check orders
SELECT * FROM orders WHERE id = 'test-123';
```

### Monitor Network
Use browser dev tools to monitor:
- API requests
- Network responses
- Console errors

## Test Data

### Test Cards
| Card Type | Number | Result |
|-----------|--------|--------|
| Visa Success | 4000 0000 0000 0002 | Success |
| Mastercard Success | 5555 5555 5555 4444 | Success |
| Visa Fail | 4000 0000 0000 9995 | Insufficient Funds |
| Mastercard Fail | 5100 0000 0000 0008 | Invalid Card |

### Test Customer Data
```
Name: Test User
Email: test@example.com
Phone: +201234567890
Address: 123 Test St, Cairo, Egypt
```

## Production Testing

Before going live:

1. **Switch to production URLs** in `paymobUtils.js`
2. **Update environment variables** with production keys
3. **Test with real payment methods**
4. **Verify webhook security**
5. **Monitor performance**

## Support

If you encounter issues:
1. Check Paymob dashboard for error logs
2. Review application logs
3. Verify all configurations
4. Contact Paymob support: support@paymob.com
