const http = require('http');

const testOrder = {
    customer: {
        fullName: 'Test Customer',
        email: 'test@example.com',
        phone: '1234567890'
    },
    shipping: {
        governorate: 'Test Gov',
        city: 'Test City',
        address: '123 Test Street',
        notes: 'Test order for email notification'
    },
    items: [
        {
            id: 3,
            productId: 3,
            name: 'Red Shoes',
            colorId: 5,
            colorName: 'Red',
            quantity: 1,
            price: 49.99
        }
    ],
    total: 49.99,
    orderNumber: 'TEST-' + Date.now(),
    date: new Date().toISOString()
};

const postData = JSON.stringify(testOrder);

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/orders',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers)}`);
    
    res.setEncoding('utf8');
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('Response:', data);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
