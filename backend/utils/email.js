const nodemailer = require('nodemailer');

const sendOrderEmail = async (orderData) => {
    try {
        console.log('=== EMAIL SENDING START ===');
        console.log('Email user:', process.env.EMAIL_USER);
        console.log('Order data:', JSON.stringify(orderData, null, 2));
        
        // Use Resend API directly (easier than SMTP)
        const resend = require('resend');
        const resendClient = new resend(process.env.RESEND_API_KEY);

        console.log('Resend client created');

        const itemsHtml = orderData.items.map(item => `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name || item.productName}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.colorName || 'N/A'}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${item.price.toFixed(2)}</td>
                <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">New Order Received!</h1>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="margin: 5px 0;"><strong>Order Number:</strong> ${orderData.orderNumber}</p>
                    <p style="margin: 5px 0;"><strong>Date:</strong> ${new Date(orderData.date).toLocaleString()}</p>
                    <p style="margin: 5px 0;"><strong>Total:</strong> <span style="color: #28a745; font-size: 18px;">$${orderData.total.toFixed(2)}</span></p>
                </div>
                
                <h3 style="color: #333;">Customer Information:</h3>
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
        `;

        // Send email using Resend API
        const { data, error } = await resendClient.emails.send({
            from: 'Fashion Store <onboarding@resend.dev>',
            to: [process.env.EMAIL_USER],
            subject: `New Order Received: ${orderData.orderNumber}`,
            html: htmlContent
        });

        if (error) {
            console.error('=== EMAIL SENDING FAILED ===');
            console.error('Error details:', error);
            return false;
        }

        console.log('Email sent successfully:', data);
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
