class UserOrders {
    constructor() {
        this.currentUser = null;
        this.orders = [];
        this.init();
    }

    init() {
        this.checkAuth();
        this.setupEventListeners();
        if (this.currentUser) {
            this.loadUserOrders();
        }
    }

    checkAuth() {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser'));
        
        if (!currentUser || !currentUser.email) {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
            return;
        }

        this.currentUser = currentUser;
        this.updateUserInfo();
    }

    updateUserInfo() {
        document.getElementById('user-name').textContent = this.currentUser.fullName || 'User';
        document.getElementById('user-email').textContent = this.currentUser.email || '';
    }

    setupEventListeners() {
        // Logout functionality
        document.getElementById('logout-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.logout();
        });

        // Modal close functionality
        document.querySelector('.close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on outside click
        document.getElementById('order-modal').addEventListener('click', (e) => {
            if (e.target.id === 'order-modal') {
                this.closeModal();
            }
        });
    }

    logout() {
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }

    async loadUserOrders() {
        try {
            this.showLoading(true);
            
            // Get current user from localStorage
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser'));
            
            if (!currentUser || !currentUser.email) {
                throw new Error('User not found');
            }
            
            const response = await fetch(`/api/orders/user?email=${encodeURIComponent(currentUser.email)}`);

            if (!response.ok) {
                if (response.status === 401) {
                    this.logout();
                    return;
                }
                throw new Error('Failed to load orders');
            }

            const orders = await response.json();
            this.orders = orders;
            this.updateOrderStats();
            this.renderOrders();
            
        } catch (error) {
            console.error('Error loading orders:', error);
            this.showError('Failed to load your orders. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    updateOrderStats() {
        const totalOrders = this.orders.length;
        const pendingOrders = this.orders.filter(order => 
            order.status === 'pending' || order.status === 'processing'
        ).length;
        const completedOrders = this.orders.filter(order => 
            order.status === 'delivered'
        ).length;

        document.getElementById('total-orders').textContent = totalOrders;
        document.getElementById('pending-orders').textContent = pendingOrders;
        document.getElementById('completed-orders').textContent = completedOrders;
    }

    renderOrders() {
        const ordersList = document.getElementById('orders-list');
        const emptyState = document.getElementById('empty-state');

        if (this.orders.length === 0) {
            ordersList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        ordersList.style.display = 'grid';
        emptyState.style.display = 'none';

        ordersList.innerHTML = this.orders.map(order => this.createOrderCard(order)).join('');

        // Add click listeners to order cards
        document.querySelectorAll('.order-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.btn')) {
                    const orderId = card.dataset.orderId;
                    this.showOrderDetails(orderId);
                }
            });
        });

        // Add track order button listeners
        document.querySelectorAll('.track-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const orderNumber = btn.dataset.orderNumber;
                window.location.href = `track-order.html?order=${orderNumber}`;
            });
        });
    }

    createOrderCard(order) {
        const statusClass = `status-${order.status}`;
        const formattedDate = new Date(order.date).toLocaleDateString();
        const itemsPreview = order.items.slice(0, 2);
        const remainingItems = order.items.length - itemsPreview.length;

        return `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-header">
                    <div>
                        <div class="order-number">${order.orderNumber}</div>
                        <div class="order-date">${formattedDate}</div>
                    </div>
                    <div class="order-status ${statusClass}">${order.status}</div>
                </div>
                
                <div class="order-info">
                    <div class="info-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <div>
                            <div class="info-label">Shipping to</div>
                            <div class="info-value">${order.shipping.city}</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-box"></i>
                        <div>
                            <div class="info-label">Items</div>
                            <div class="info-value">${order.items.length} products</div>
                        </div>
                    </div>
                </div>

                <div class="order-items-preview">
                    <div class="items-preview-header">
                        <h4>Items</h4>
                        <span class="item-count">${order.items.length} items</span>
                    </div>
                    <div class="items-list">
                        ${itemsPreview.map(item => `
                            <div class="order-item">
                                <img src="${item.image || 'https://via.placeholder.com/50'}" 
                                     alt="${item.name}" 
                                     class="item-image">
                                <div class="item-details">
                                    <div class="item-name">${item.name}</div>
                                    <div class="item-color">${item.colorName || 'Default'}</div>
                                </div>
                                <div class="item-quantity">x${item.quantity}</div>
                            </div>
                        `).join('')}
                        ${remainingItems > 0 ? `
                            <div class="order-item">
                                <div class="item-details">
                                    <div class="item-name">+${remainingItems} more items</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="order-total">
                    <span class="total-label">Total Amount:</span>
                    <span class="total-amount">$${order.total.toFixed(2)}</span>
                </div>

                <div class="order-actions">
                    <button class="btn btn-primary track-order-btn" data-order-number="${order.orderNumber}">
                        <i class="fas fa-truck"></i> Track Order
                    </button>
                    <button class="btn btn-secondary view-details-btn" data-order-id="${order.id}">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </div>
            </div>
        `;
    }

    showOrderDetails(orderId) {
        const order = this.orders.find(o => o.id == orderId);
        if (!order) return;

        const modalBody = document.getElementById('order-details');
        modalBody.innerHTML = this.createOrderDetailsHTML(order);
        
        document.getElementById('order-modal').style.display = 'block';
    }

    createOrderDetailsHTML(order) {
        const formattedDate = new Date(order.date).toLocaleString();
        const statusClass = `status-${order.status}`;

        return `
            <div class="order-details-header">
                <h4>Order ${order.orderNumber}</h4>
                <div class="order-status ${statusClass}">${order.status}</div>
            </div>

            <div class="order-details-grid">
                <div class="detail-section">
                    <h5>Order Information</h5>
                    <div class="detail-item">
                        <span class="label">Order Date:</span>
                        <span class="value">${formattedDate}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Total Amount:</span>
                        <span class="value">$${order.total.toFixed(2)}</span>
                    </div>
                    ${order.trackingNumber ? `
                        <div class="detail-item">
                            <span class="label">Tracking Number:</span>
                            <span class="value">${order.trackingNumber}</span>
                        </div>
                    ` : ''}
                    ${order.estimatedDelivery ? `
                        <div class="detail-item">
                            <span class="label">Estimated Delivery:</span>
                            <span class="value">${new Date(order.estimatedDelivery).toLocaleDateString()}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="detail-section">
                    <h5>Shipping Address</h5>
                    <div class="detail-item">
                        <span class="value">${order.customer.fullName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="value">${order.shipping.address}</span>
                    </div>
                    <div class="detail-item">
                        <span class="value">${order.shipping.city}, ${order.shipping.governorate}</span>
                    </div>
                    ${order.shipping.notes ? `
                        <div class="detail-item">
                            <span class="label">Notes:</span>
                            <span class="value">${order.shipping.notes}</span>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="detail-section">
                <h5>Order Items</h5>
                <div class="order-items-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Color</th>
                                <th>Quantity</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items.map(item => `
                                <tr>
                                    <td>
                                        <div class="product-info">
                                            <img src="${item.image || 'https://via.placeholder.com/40'}" 
                                                 alt="${item.name}" 
                                                 class="product-thumb">
                                            <span>${item.name}</span>
                                        </div>
                                    </td>
                                    <td>${item.colorName || 'N/A'}</td>
                                    <td>${item.quantity}</td>
                                    <td>$${item.price.toFixed(2)}</td>
                                    <td>$${(item.price * item.quantity).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <th colspan="4">Total:</th>
                                <th>$${order.total.toFixed(2)}</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }

    closeModal() {
        document.getElementById('order-modal').style.display = 'none';
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const ordersList = document.getElementById('orders-list');
        const emptyState = document.getElementById('empty-state');

        if (show) {
            loading.style.display = 'block';
            ordersList.style.display = 'none';
            emptyState.style.display = 'none';
        } else {
            loading.style.display = 'none';
        }
    }

    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }
}

// Initialize the user orders page
document.addEventListener('DOMContentLoaded', () => {
    new UserOrders();
});

// Add some additional styles for the modal and details
const additionalStyles = `
    .order-details-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 2px solid #eee;
    }
    
    .order-details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-bottom: 30px;
    }
    
    .detail-section h5 {
        color: #333;
        margin-bottom: 15px;
        font-size: 1.1rem;
    }
    
    .detail-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
        padding: 8px 0;
    }
    
    .detail-item .label {
        color: #666;
        font-weight: 500;
    }
    
    .detail-item .value {
        color: #333;
        font-weight: 600;
    }
    
    .product-info {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .product-thumb {
        width: 40px;
        height: 40px;
        object-fit: cover;
        border-radius: 5px;
    }
    
    .order-items-table {
        overflow-x: auto;
    }
    
    .order-items-table table {
        width: 100%;
        border-collapse: collapse;
    }
    
    .order-items-table th,
    .order-items-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #eee;
    }
    
    .order-items-table th {
        background: #f8f9fa;
        font-weight: 600;
        color: #333;
    }
    
    .order-items-table tfoot th {
        background: #667eea;
        color: white;
    }
    
    .error-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        padding: 15px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 2000;
        box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    
    .error-notification button {
        background: none;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        color: #721c24;
    }
    
    @media (max-width: 768px) {
        .order-details-grid {
            grid-template-columns: 1fr;
        }
        
        .detail-item {
            flex-direction: column;
            gap: 5px;
        }
        
        .order-items-table {
            font-size: 0.9rem;
        }
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);
