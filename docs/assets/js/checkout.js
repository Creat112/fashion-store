import { api } from './api.js';

let selectedLocation = null;

window.addEventListener("DOMContentLoaded", () => {
    // We get items from localStorage passed from cart page
    const checkoutItems = JSON.parse(localStorage.getItem("checkoutItems")) || [];
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

            li.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px">
                    <img src="${item.colorImage || item.image}" width="50" style="object-fit:cover; height:50px; border-radius:4px" />
                    <div>
                        <span>${item.name} × ${item.quantity}</span>
                        ${item.colorName ? `<br><small style="color:#666">Color: ${item.colorName}</small>` : ''}
                    </div>
                </div>
                <b>$${(item.price * item.quantity).toFixed(2)}</b>
            `;

            listContainer.appendChild(li);
            total += item.price * item.quantity;
        });
    }

    if (totalSpan) totalSpan.textContent = `$${total.toFixed(2)}`;

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
                // Submit to API
                const result = await api.post('/orders', orderData);

                if (result.success || result.orderId) {
                    sessionStorage.setItem("currentOrder", JSON.stringify(orderData));
                    localStorage.removeItem("checkoutItems");

                    // Clear cart from server if user is logged in
                    // In a real app the server would do this automatically upon order creation
                    // but since we are using a separate cart API call...
                    // Let's assume the user is logged in here or we iterate cleanup.
                    // For now, simple redirect.

                    // Show processing message and wait 30 seconds
                    const submitBtn = document.getElementById('submit-order-btn');
                    const originalText = submitBtn.textContent;
                    submitBtn.textContent = 'Processing order... Please wait 30 seconds';
                    submitBtn.disabled = true;

                    // Wait 30 seconds before redirecting
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
