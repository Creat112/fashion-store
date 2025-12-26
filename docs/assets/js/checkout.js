import { api } from './api.js';

let selectedLocation = null;

window.addEventListener("DOMContentLoaded", () => {
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
            li.style.padding = "10px";
            li.style.border = "1px solid #ddd";
            li.style.borderRadius = "8px";
            
            // Create item details
            const itemDetails = document.createElement("div");
            itemDetails.style.flex = "1";
            itemDetails.innerHTML = `
                <div style="font-weight: 600; color: #333;">${item.name}</div>
                ${item.colorName ? `<div style="font-size: 0.9rem; color: #666;">Color: ${item.colorName}</div>` : ''}
                <div style="font-size: 0.9rem; color: #666;">Qty: ${item.quantity}</div>
            `;
            
            // Create price
            const itemPrice = document.createElement("div");
            itemPrice.style.fontWeight = "600";
            itemPrice.style.color = "#27ae60";
            itemPrice.textContent = `${(item.price * item.quantity).toFixed(2)}EGP`;
            
            li.appendChild(itemDetails);
            li.appendChild(itemPrice);
            listContainer.appendChild(li);
            
            total += item.price * item.quantity;
        });
    }

    if (totalSpan) totalSpan.textContent = `$${total.toFixed(2)}`;

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
                // Direct order submission
                const result = await api.post('/orders', orderData);

                if (result.success || result.orderId) {
                    sessionStorage.setItem("currentOrder", JSON.stringify(orderData));
                    localStorage.removeItem("checkoutItems");

                    // Direct redirect without waiting
                    window.location.href = "thank-you.html";
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
