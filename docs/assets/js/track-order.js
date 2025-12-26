// Track Order JavaScript
class OrderTracker {
    constructor() {
        this.form = document.getElementById('track-order-form');
        this.orderResult = document.getElementById('order-result');
        this.loading = document.getElementById('loading');
        this.errorMessage = document.getElementById('error-message');
        
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Sample order data for demonstration
        this.sampleOrders = {
            'ORD-123456': {
                id: 'ORD-123456',
                date: '2024-12-20',
                status: 'shipped',
                estimatedDelivery: '2024-12-28',
                items: [
                    {
                        name: 'SAVX Black Set',
                        variant: 'Size: M, Color: Black',
                        price: 89.99,
                        image: 'products/Set/Sets Savax Black.jpeg'
                    },
                    {
                        name: 'SAVX White T-Shirt',
                        variant: 'Size: L, Color: White',
                        price: 39.99,
                        image: 'products/T-shirt/T-shirt savax white.jpeg'
                    }
                ],
                subtotal: 129.98,
                shipping: 9.99,
                tax: 10.40,
                total: 150.37,
                timeline: [
                    {
                        title: 'Order Placed',
                        date: 'December 20, 2024 - 2:30 PM',
                        completed: true,
                        icon: 'ri-shopping-cart-line'
                    },
                    {
                        title: 'Payment Confirmed',
                        date: 'December 20, 2024 - 2:32 PM',
                        completed: true,
                        icon: 'ri-bank-card-line'
                    },
                    {
                        title: 'Order Processed',
                        date: 'December 21, 2024 - 10:00 AM',
                        completed: true,
                        icon: 'ri-settings-3-line'
                    },
                    {
                        title: 'Shipped',
                        date: 'December 22, 2024 - 3:15 PM',
                        completed: true,
                        icon: 'ri-truck-line'
                    },
                    {
                        title: 'Delivered',
                        date: 'Estimated: December 28, 2024',
                        completed: false,
                        icon: 'ri-home-smile-line'
                    }
                ]
            },
            'ORD-789012': {
                id: 'ORD-789012',
                date: '2024-12-25',
                status: 'processing',
                estimatedDelivery: '2025-01-02',
                items: [
                    {
                        name: 'SAVX Premium Hoodie',
                        variant: 'Size: XL, Color: Gray',
                        price: 79.99,
                        image: 'products/Hoodie/Hoodie savax gray.jpeg'
                    }
                ],
                subtotal: 79.99,
                shipping: 9.99,
                tax: 7.20,
                total: 97.18,
                timeline: [
                    {
                        title: 'Order Placed',
                        date: 'December 25, 2024 - 11:45 AM',
                        completed: true,
                        icon: 'ri-shopping-cart-line'
                    },
                    {
                        title: 'Payment Confirmed',
                        date: 'December 25, 2024 - 11:47 AM',
                        completed: true,
                        icon: 'ri-bank-card-line'
                    },
                    {
                        title: 'Order Processed',
                        date: 'December 26, 2024 - 9:00 AM',
                        completed: false,
                        icon: 'ri-settings-3-line'
                    },
                    {
                        title: 'Shipped',
                        date: 'Estimated: December 27, 2024',
                        completed: false,
                        icon: 'ri-truck-line'
                    },
                    {
                        title: 'Delivered',
                        date: 'Estimated: January 2, 2025',
                        completed: false,
                        icon: 'ri-home-smile-line'
                    }
                ]
            }
        };
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.form);
        const orderId = formData.get('orderId').trim().toUpperCase();
        
        if (!orderId) {
            this.showError('Please enter an order ID');
            return;
        }
        
        this.showLoading();
        
        // Simulate API call delay
        setTimeout(() => {
            this.trackOrder(orderId);
        }, 0);
    }

    async trackOrder(orderId) {
        let timeoutId;
        try {
            // Call real API endpoint
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(`/api/orders/track/${orderId}`, { signal: controller.signal });
            
            // Check if response is HTML (error page) instead of JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Server returned HTML instead of JSON:', text.substring(0, 200));
                this.showError('Server configuration error. Please contact support.');
                return;
            }
            
            if (!response.ok) {
                if (response.status === 404) {
                    this.showError(`Order with ID "${orderId}" not found. Please check your order ID and try again.`);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    this.showError(errorData.error || `Server error: ${response.status}`);
                }
                return;
            }
            
            const order = await response.json();
            this.displayOrder(order);
            
        } catch (error) {
            console.error('Order tracking error:', error);
            if (error?.name === 'AbortError') {
                this.showError('Request timed out. Please try again.');
            } else if (error.message.includes('Failed to fetch')) {
                this.showError('Unable to connect to the server. Please check your internet connection.');
            } else {
                this.showError('An unexpected error occurred. Please try again later.');
            }
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
            this.hideLoading();
        }
    }

    displayOrder(order) {
        this.hideError();
        
        // Generate timeline based on order status and dates
        const timeline = this.generateTimeline(order);
        
        const orderHTML = `
            <div class="order-header">
                <div class="order-id">Order #${order.orderNumber}</div>
                <div class="order-date">Placed on ${new Date(order.date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</div>
            </div>
            
            <div class="order-status">
                <h3>Order Status</h3>
                <span class="status-badge status-${order.status}">${order.status}</span>
                ${order.trackingNumber ? `<p>Tracking Number: ${order.trackingNumber}</p>` : ''}
                ${order.estimatedDelivery ? `<p>Estimated Delivery: ${new Date(order.estimatedDelivery).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</p>` : ''}
            </div>
            
            <div class="order-timeline">
                <h3>Order Timeline</h3>
                ${timeline.map(item => `
                    <div class="timeline-item ${item.completed ? 'completed' : ''}">
                        <div class="timeline-icon">
                            <i class="${item.icon}"></i>
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-title">${item.title}</div>
                            <div class="timeline-date">${item.date}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="order-items">
                <h3>Order Items</h3>
                ${order.items.map(item => `
                    <div class="order-item">
                        <img src="/${item.image}" alt="${item.name}" onerror="this.src='assets/images/placeholder.jpg'">
                        <div class="order-item-details">
                            <div class="order-item-name">${item.name}</div>
                            <div class="order-item-variant">${item.colorName ? `Color: ${item.colorName}` : ''} | Quantity: ${item.quantity}</div>
                            <div class="order-item-price">EGP ${item.price.toFixed(2)} each</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div class="order-summary">
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>EGP ${order.total.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>Shipping:</span>
                    <span>Free</span>
                </div>
                <div class="summary-row total">
                    <span>Total:</span>
                    <span>EGP ${order.total.toFixed(2)}</span>
                </div>
            </div>
        `;
        
        this.orderResult.innerHTML = orderHTML;
        this.orderResult.style.display = 'block';
        
        // Scroll to result
        this.orderResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    generateTimeline(order) {
        const timeline = [];
        const orderDate = new Date(order.date);
        
        // Order Placed
        timeline.push({
            title: 'Order Placed',
            date: orderDate.toLocaleString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            completed: true,
            icon: 'ri-shopping-cart-line'
        });
        
        // Order Confirmed (assuming immediate confirmation)
        timeline.push({
            title: 'Order Confirmed',
            date: orderDate.toLocaleString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            completed: true,
            icon: 'ri-check-line'
        });
        
        // Processing
        if (order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered') {
            timeline.push({
                title: 'Order Processing',
                date: orderDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: true,
                icon: 'ri-settings-3-line'
            });
        } else {
            timeline.push({
                title: 'Order Processing',
                date: 'Estimated: ' + new Date(orderDate.getTime() + 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: false,
                icon: 'ri-settings-3-line'
            });
        }
        
        // Shipped
        if (order.status === 'shipped' || order.status === 'delivered') {
            const shippedDate = order.shippedDate ? new Date(order.shippedDate) : new Date(orderDate.getTime() + 48 * 60 * 60 * 1000);
            timeline.push({
                title: 'Order Shipped',
                date: shippedDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: true,
                icon: 'ri-truck-line'
            });
        } else if (order.status === 'processing') {
            timeline.push({
                title: 'Order Shipped',
                date: 'Estimated: ' + new Date(orderDate.getTime() + 48 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: false,
                icon: 'ri-truck-line'
            });
        }
        
        // Delivered
        if (order.status === 'delivered') {
            const deliveredDate = order.deliveredDate ? new Date(order.deliveredDate) : new Date(orderDate.getTime() + 120 * 60 * 60 * 1000);
            timeline.push({
                title: 'Order Delivered',
                date: deliveredDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: true,
                icon: 'ri-home-smile-line'
            });
        } else if (order.status === 'shipped' && order.estimatedDelivery) {
            timeline.push({
                title: 'Order Delivered',
                date: 'Estimated: ' + new Date(order.estimatedDelivery).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric'
                }),
                completed: false,
                icon: 'ri-home-smile-line'
            });
        }
        
        return timeline;
    }

    showLoading() {
        this.loading.style.display = 'block';
        this.orderResult.style.display = 'none';
        this.hideError();
    }

    hideLoading() {
        this.loading.style.display = 'none';
    }

    showError(message) {
        this.errorMessage.innerHTML = `
            <i class="ri-error-warning-line"></i>
            <p>${message}</p>
        `;
        this.errorMessage.style.display = 'block';
        this.orderResult.style.display = 'none';
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }
}

// Initialize when DOM is loaded
let orderTracker;
document.addEventListener('DOMContentLoaded', () => {
    orderTracker = new OrderTracker();
});

// Mobile menu functionality (reuse from main app)
document.getElementById('menu-btn')?.addEventListener('click', () => {
    const navLinks = document.getElementById('nav-links');
    navLinks.classList.toggle('active');
});
