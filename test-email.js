require('dotenv').config();
const { sendOrderEmail } = require('./backend/utils/email');

// Test email with REAL order data from checkout
const testOrder = {
    orderNumber: 'TEST-1766615639733',
    date: '2025-12-24T22:33:59.733Z',
    total: 49.99,
    customer: {
        fullName: 'Test Customer',
        email: 'test@example.com',
        phone: '1234567890'
    },
    shipping: {
        address: '123 Test Street',
        city: 'Test City',
        governorate: 'Test Gov',
        notes: 'Test order for email notification'
    },
    items: [
        {
            productId: 3,
            quantity: 1,
            price: 49.99,
            name: 'Red Shoes',
            colorId: 5,
            colorName: 'Red'
        }
    ]
};

console.log('Testing email functionality...');
sendOrderEmail(testOrder)
    .then(success => {
        console.log('Email test result:', success ? 'SUCCESS' : 'FAILED');
        process.exit(0);
    })
    .catch(error => {
        console.error('Email test error:', error);
        process.exit(1);
    });
