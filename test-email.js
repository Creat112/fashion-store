const { Resend } = require('resend');

async function testEmail() {
    console.log('Testing email with CUSTOMER_RESEND_API...');
    console.log('API Key:', process.env.CUSTOMER_RESEND_API ? 'SET' : 'NOT SET');
    
    try {
        const resend = new Resend('re_FjPTMR9H_BdDqWABZnz7tRfnYeqYqfaYQ');
        
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: ['sasaabdelhady333@gmail.com'],
            subject: 'Test Email from SAVX',
            html: '<h1>Test Email</h1><p>This is a test email to verify the Resend API is working.</p>'
        });
        
        if (error) {
            console.error('Email failed:', error);
            return false;
        }
        
        console.log('Email sent successfully:', data);
        return true;
    } catch (err) {
        console.error('Error sending email:', err);
        return false;
    }
}

testEmail();
