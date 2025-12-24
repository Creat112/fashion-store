require('dotenv').config();
const { sendOrderEmail } = require('./backend/utils/email');

// Test email with sample order data
const testOrder = {
    orderNumber: 'TEST-001',
    date: new Date().toISOString(),
    total: 99.99,
    customer: {
        fullName: 'Test Customer',
        email: 'test@example.com',
        phone: '1234567890'
    },
    shipping: {
        address: '123 Test Street',
        city: 'Test City',
        governorate: 'Test Governorate'
    },
    items: [
        {
            name: 'Test Product',
            quantity: 1,
            price: 99.99
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
