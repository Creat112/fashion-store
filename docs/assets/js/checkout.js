import { api } from './api.js';

let selectedLocation = null;
let stripe;
let elements;
let clientSecret;

window.addEventListener("DOMContentLoaded", () => {
    // Initialize Stripe
    stripe = Stripe('pk_test_your_publishable_key_here'); // Replace with your actual key
    
    // We get items from localStorage passed from cart page
    let checkoutItems = [];
    try {
        checkoutItems = JSON.parse(localStorage.getItem("checkoutItems")) || [];
    } catch (error) {
        console.error('localStorage access blocked:', error);
        // Fallback: try sessionStorage or show message
        try {
            checkoutItems = JSON.parse(sessionStorage.getItem("checkoutItems")) || [];
        } catch (sessionError) {
            console.error('sessionStorage also blocked:', sessionError);
            alert('Your browser is blocking local storage. Please enable storage access or use a different browser to complete your purchase.');
            return;
        }
    }
    const listContainer = document.getElementById("checkout-list");
    const totalSpan = document.getElementById("order-total");
    const checkoutForm = document.getElementById("checkoutForm");

    let total = 0;

    if (checkoutItems.length === 0) {
        if (listContainer) listContainer.innerHTML = "<p>Your cart is empty.</p>";
        if (totalSpan) totalSpan.textContent = "$0.00";
        return;
    }

    // Render items
    if (listContainer) {
        checkoutItems.forEach(item => {
            const li = document.createElement("li");
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.justifyContent = "space-between";
            li.style.marginBottom = "10px";
            listContainer.appendChild(li);
            total += item.price * item.quantity;
        });
    }

    if (totalSpan) totalSpan.textContent = `$${total.toFixed(2)}`;

    // Initialize Stripe payment
    initializePayment(total);

    // Location handling (existing code)
    // ... (keep existing location code)

    // Map Setup
    if (document.getElementById('map')) {
        const map = L.map('map').setView([30.0444, 31.2357], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        let marker = null;
        map.on('click', function (e) {
            const { lat, lng } = e.latlng;
            if (marker) map.removeLayer(marker);
            marker = L.marker([lat, lng]).addTo(map);
            selectedLocation = { lat, lng };
        });

        const gpsBtn = document.getElementById('gps-btn');
        if (gpsBtn) {
            gpsBtn.addEventListener('click', () => {
                navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    if (marker) map.removeLayer(marker);
                    marker = L.marker([latitude, longitude]).addTo(map);
                    map.setView([latitude, longitude], 12);
                    selectedLocation = { lat: latitude, lng: longitude };
                }, (err) => {
                    alert('Unable to fetch your location.');
                });
            });
        }
    }

    // Handle Form Submit
    if (checkoutForm) {
        checkoutForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            const fullName = document.getElementById("fullName").value;
            const email = document.getElementById("email").value;
            const phone = document.getElementById("phone").value;
            const secondaryPhone = document.getElementById("secondaryPhone").value || null;
            const governorate = document.getElementById("governorate").value;
            const city = document.getElementById("city").value;
            const address = document.getElementById("address").value;
            const notes = document.getElementById("notes").value || "No notes";

            const orderData = {
                customer: { fullName, email, phone, secondaryPhone },
                shipping: { governorate, city, address, notes, location: selectedLocation },
                items: checkoutItems,
                total: total,
                orderNumber: "ORD-" + Math.floor(100000 + Math.random() * 900000),
                date: new Date().toISOString()
            };

            try {
                // Process payment with Stripe first
                if (!stripe || !elements) {
                    alert('Payment system not ready. Please refresh the page.');
                    return;
                }

                const { error } = await stripe.confirmPayment({
                    elements,
                    confirmParams: {
                        return_url: `${window.location.origin}/thank-you.html`,
                        payment_method_data: {
                            billing_details: {
                                name: customer.fullName,
                                email: customer.email,
                                phone: customer.phone,
                                address: {
                                    line1: shipping.address,
                                    city: shipping.city,
                                    state: shipping.governorate,
                                    country: 'EG'
                                }
                            }
                        }
                    },
                });

                if (error) {
                    showMessage(error.message);
                    return;
                }

                // If payment successful, submit order
                const result = await api.post('/orders', orderData);

                if (result.success || result.orderId) {
                    sessionStorage.setItem("currentOrder", JSON.stringify(orderData));
                    localStorage.removeItem("checkoutItems");

                    // Wait 30 seconds before redirecting
                    const submitBtn = document.getElementById('submit-order-btn');
                    if (submitBtn) {
                        submitBtn.textContent = 'Processing order... Please wait 30 seconds';
                        submitBtn.disabled = true;
                    }

                    setTimeout(() => {
                        window.location.href = "thank-you.html";
                    }, 30000);
                } else {
                    alert('Failed to place order: ' + (result.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Order error:', error);
                alert('Error placing order. Please try again.');
            }
        });
    }
});

// Stripe Payment Functions
async function initializePayment(amount) {
    try {
        console.log('Initializing payment for amount:', amount);
        
        // Check if Stripe is properly initialized
        if (!stripe) {
            throw new Error('Stripe not initialized. Check your publishable key.');
        }
        
        // Create payment intent
        const response = await api.post('/payment/create-payment-intent', {
            amount: amount,
            currency: 'usd'
        });
        
        console.log('Payment intent response:', response);
        
        if (!response.clientSecret) {
            throw new Error('No client secret received from server');
        }
        
        clientSecret = response.clientSecret;
        
        // Create and mount Stripe Elements
        const appearance = { theme: 'stripe' };
        elements = stripe.elements({ appearance, clientSecret });
        
        const paymentElement = elements.create('payment-element');
        paymentElement.mount('#payment-element');
        
        console.log('Payment element mounted successfully');
        
    } catch (error) {
        console.error('Payment initialization failed:', error);
        
        // More specific error messages
        if (error.message.includes('404')) {
            showMessage('Payment endpoint not found. Server may need restart.');
        } else if (error.message.includes('<!DOCTYPE')) {
            showMessage('Server returned HTML instead of JSON. Check server configuration.');
        } else {
            showMessage('Payment initialization failed: ' + error.message);
        }
    }
}

async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    if (!stripe || !elements) {
        return;
    }

    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            return_url: `${window.location.origin}/thank-you.html`,
        },
    });

    if (error.type === "card_error" || error.type === "validation_error") {
        showMessage(error.message);
    } else {
        showMessage("An unexpected error occurred.");
    }

    setLoading(false);
}

function showMessage(messageText) {
    const messageContainer = document.getElementById("payment-message");
    if (messageContainer) {
        messageContainer.textContent = messageText;
        setTimeout(() => {
            messageContainer.textContent = "";
        }, 4000);
    }
}

function setLoading(isLoading) {
    const submitBtn = document.getElementById('submit-order-btn');
    if (submitBtn) {
        if (isLoading) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Processing...";
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = "Place Order";
        }
    }
}
