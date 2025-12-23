const nodemailer = require('nodemailer');

const sendOrderEmail = async (orderData) => {
    try {
        // Create a transporter
        // NOTE: For production, use environment variables!
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'placeholder@gmail.com',
                pass: process.env.EMAIL_PASS || 'placeholder_password'
            }
        });

        const itemsHtml = orderData.items.map(item =>
            `<li>${item.name || item.productName} × ${item.quantity} - $${(item.price * item.quantity).toFixed(2)}</li>`
        ).join('');

        const mailOptions = {
            from: '"Fashion Store" <' + (process.env.EMAIL_USER || 'placeholder@gmail.com') + '>',
            to: 'sasaabdelhady333@gmail.com',
            subject: `New Order Received: ${orderData.orderNumber}`,
            html: `
                <h1>New Order Received!</h1>
                <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
                <p><strong>Date:</strong> ${new Date(orderData.date).toLocaleString()}</p>
                <p><strong>Total:</strong> $${orderData.total.toFixed(2)}</p>
                
                <h3>Customer Details:</h3>
                <p>
                    ${orderData.customer.fullName}<br>
                    ${orderData.customer.email}<br>
                    ${orderData.customer.phone}
                </p>
                
                <h3>Shipping Address:</h3>
                <p>
                    ${orderData.shipping.address}<br>
                    ${orderData.shipping.city}, ${orderData.shipping.governorate}
                </p>
                
                <h3>Items:</h3>
                <ul>
                    ${itemsHtml}
                </ul>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        // We don't throw here to avoid failing the order if email fails
        return false;
    }
};

module.exports = { sendOrderEmail };
