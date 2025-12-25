const nodemailer = require('nodemailer');

const sendOrderEmail = async (orderData) => {
    try {
        console.log('=== EMAIL SENDING START ===');
        console.log('Email user:', process.env.EMAIL_USER);
        console.log('Email pass exists:', !!process.env.EMAIL_PASS);
        console.log('Order data:', JSON.stringify(orderData, null, 2));
        
        // Create a transporter
        // NOTE: Try different service if Gmail fails
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'placeholder@gmail.com',
                pass: process.env.EMAIL_PASS || 'placeholder_password'
            },
            // Add these options for better reliability
            tls: {
                rejectUnauthorized: false
            },
            pool: true,
            maxConnections: 1,
            rateDelta: 20000,
            rateLimit: 5
        });

        console.log('Transporter created successfully');

        const itemsHtml = orderData.items.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name || item.productName}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.colorName || 'N/A'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.price.toFixed(2)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        const mailOptions = {
            from: '"Fashion Store" <' + (process.env.EMAIL_USER || 'placeholder@gmail.com') + '>',
            to: 'sasaabdelhady333@gmail.com',
            subject: `New Order Received: ${orderData.orderNumber}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">New Order Received!</h1>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="margin: 5px 0;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
                        <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(orderData.date).toLocaleString()}</p>
                        <p style="margin: 5px 0;"><strong>Total:</strong> <span style="color: #28a745; font-size: 18px;">$${orderData.total.toFixed(2)}</span></p>
                    </div>
                    
                    <h3 style="color: #333;">Customer Details:</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="margin: 5px 0;"><strong>Name:</strong> ${orderData.customer.fullName}</p>
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${orderData.customer.email}</p>
                        <p style="margin: 5px 0;"><strong>Phone:</strong> ${orderData.customer.phone}</p>
                        ${orderData.customer.secondaryPhone ? `<p style="margin: 5px 0;"><strong>Secondary Phone:</strong> ${orderData.customer.secondaryPhone}</p>` : ''}
                    </div>
                    
                    <h3 style="color: #333;">Shipping Address:</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                        <p style="margin: 5px 0;"><strong>Address:</strong> ${orderData.shipping.address}</p>
                        <p style="margin: 5px 0;"><strong>City:</strong> ${orderData.shipping.city}</p>
                        <p style="margin: 5px 0;"><strong>Governorate:</strong> ${orderData.shipping.governorate}</p>
                        ${orderData.shipping.notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${orderData.shipping.notes}</p>` : ''}
                        ${orderData.shipping.location ? `<p style="margin: 5px 0;"><strong>Location:</strong> Lat: ${orderData.shipping.location.lat}, Lng: ${orderData.shipping.location.lng}</p>` : ''}
                    </div>
                    
                    <h3 style="color: #333;">Order Items:</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background: #007bff; color: white;">
                                <th style="padding: 10px; text-align: left;">Product</th>
                                <th style="padding: 10px; text-align: left;">Color</th>
                                <th style="padding: 10px; text-align: center;">Quantity</th>
                                <th style="padding: 10px; text-align: right;">Price</th>
                                <th style="padding: 10px; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHtml}
                        </tbody>
                        <tfoot>
                            <tr style="background: #f8f9fa; font-weight: bold;">
                                <td colspan="4" style="padding: 10px; text-align: right;">Total:</td>
                                <td style="padding: 10px; text-align: right; color: #28a745;">$${orderData.total.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
                        <p>This is an automated notification from Fashion Store.</p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        console.log('Email response:', info);
        console.log('=== EMAIL SENDING SUCCESS ===');
        return true;
    } catch (error) {
        console.error('=== EMAIL SENDING FAILED ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        // We don't throw here to avoid failing the order if email fails
        return false;
    }
};

module.exports = { sendOrderEmail };
