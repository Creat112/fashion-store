// admin.js
import { api } from './api.js';

const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser'));
if (!currentUser || currentUser.role !== 'admin') {
    window.location.href = 'login.html';
    throw new Error('Not authenticated or authorized');
}

// Logout listener
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUser');
            window.location.href = 'login.html';
        });
    }

    // Orders Delegation
    const ordersList = document.getElementById('orders-list');
    if (ordersList) {
        ordersList.addEventListener('click', async (e) => {
            const statusBtn = e.target.closest('.status-toggle');
            const deleteBtn = e.target.closest('.delete-order');

            if (statusBtn) {
                const id = statusBtn.dataset.id;
                console.log('Status toggle clicked for order:', id);
                const currentStatus = statusBtn.dataset.status;
                const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
                try {
                    await updateOrderStatus(id, newStatus);
                    renderOrders();
                } catch (err) {
                    console.error('Error updating status:', err);
                    alert('Failed to update order status');
                }
            }

            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                console.log('Delete button clicked for order ID:', id);

                if (deleteBtn.classList.contains('confirming')) {
                    // Second click - perform deletion
                    try {
                        console.log('Confirmed! Sending delete request for order:', id);
                        deleteBtn.disabled = true;
                        deleteBtn.textContent = 'Deleting...';
                        const result = await deleteOrder(id);
                        console.log('Delete result:', result);
                        renderOrders();
                        renderStats();
                    } catch (err) {
                        console.error('Error during deletion process:', err);
                        alert('Failed to delete order: ' + err.message);
                        deleteBtn.disabled = false;
                        deleteBtn.textContent = 'Delete';
                        deleteBtn.classList.remove('confirming');
                    }
                } else {
                    // First click - ask for confirmation
                    console.log('First click - switching to confirming state');
                    deleteBtn.classList.add('confirming');
                    deleteBtn.textContent = 'Click again to confirm';

                    // Reset after 3 seconds if not clicked again
                    setTimeout(() => {
                        if (deleteBtn && deleteBtn.classList.contains('confirming')) {
                            deleteBtn.classList.remove('confirming');
                            deleteBtn.textContent = 'Delete';
                        }
                    }, 3000);
                }
            }
        });
    }
});

// DOM elements
const tabs = document.querySelectorAll('.nav-item');
const tabSections = document.querySelectorAll('.tab');

const productsListEl = document.getElementById('products-list');
const ordersListEl = document.getElementById('orders-list');
const statsRevenueEl = document.getElementById('stat-revenue');
const statsOrdersEl = document.getElementById('stat-orders');
const statsAovEl = document.getElementById('stat-aov');

const productForm = document.getElementById('product-form');
const pId = document.getElementById('product-id');
const pName = document.getElementById('p-name');
const pPrice = document.getElementById('p-price');
const pStock = document.getElementById('p-stock');
const pCategory = document.getElementById('p-category');
const pImage = document.getElementById('p-image');
const pDesc = document.getElementById('p-desc');
const productFormTitle = document.getElementById('product-form-title');
const productCancel = document.getElementById('product-cancel');

const themeToggle = document.getElementById('theme-toggle');
const exportBtn = document.getElementById('export-orders');

// Theme handling
const applyTheme = (theme) => {
    document.body.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('admin-theme', theme);
};

themeToggle.addEventListener('click', () => {
    const current = localStorage.getItem('admin-theme') || 'light';
    applyTheme(current === 'light' ? 'dark' : 'light');
});
applyTheme(localStorage.getItem('admin-theme') || 'light');

// -------------------------
// API Call Wrappers
// -------------------------
const getAllProducts = async () => {
    try {
        return await api.get('/products?includeDisabled=true');
    } catch (err) {
        console.error('Error fetching products:', err);
        return [];
    }
};

const getOrders = async () => {
    try {
        return await api.get('/orders');
    } catch (err) {
        console.error('Error fetching orders:', err);
        return [];
    }
};

const saveProduct = async (product) => {
    // If it's an update and image is empty, don't send it to prevent overwriting
    if (product.id && (!product.image || product.image === '')) {
        delete product.image;
    }

    if (product.id) {
        return await api.put(`/products/${product.id}`, product);
    } else {
        return await api.post('/products', product);
    }
};

const deleteProduct = async (id) => {
    return await api.delete(`/products/${id}`);
};

const deleteOrder = async (id) => {
    return await api.delete(`/orders/${id}`);
};

const updateOrderStatus = async (id, status) => {
    return await api.put(`/orders/${id}`, { status });
};

// -------------------------
// Orders & Polling
// -------------------------
let currentOrders = [];

// Poll for notifications
setInterval(async () => {
    const newOrders = await getOrders();
    // Simple check: if length changed, notify (in real app, check IDs)
    if (newOrders.length > currentOrders.length) {
        // Show notification toast or sound
        showNotification(`New order received! Order #${newOrders[0].orderNumber}`);
        currentOrders = newOrders;
        if (document.getElementById('tab-orders').classList.contains('active')) {
            renderOrders();
        }
        renderStats();
    }
}, 15000); // Check every 15 seconds

function showNotification(msg) {
    const div = document.createElement('div');
    div.style = `
        position: fixed; bottom: 20px; right: 20px; 
        background: #2ecc71; color: white; padding: 15px 25px; 
        border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1000; animation: slideIn 0.3s ease-out;
    `;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
}

// -------------------------
// Tabs
// -------------------------
tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const target = t.dataset.tab;
    tabSections.forEach(s => s.classList.toggle('active', s.id === `tab-${target}`));
    if (target === 'products') renderProducts();
    if (target === 'orders') renderOrders();
    if (target === 'stats') renderStats();
}));

// -------------------------
// Image Base64 storage
// -------------------------
let imageBase64 = '';
pImage.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => imageBase64 = reader.result;
    reader.readAsDataURL(file);
});

// -------------------------
// Render Products
// -------------------------
async function renderProducts() {
    productsListEl.innerHTML = '<div class="small-muted">Loading products...</div>';
    try {
        const products = await getAllProducts();
        if (!products.length) {
            productsListEl.innerHTML = '<p class="small-muted">No products found.</p>';
            return;
        }

        productsListEl.innerHTML = '';
        products.forEach(p => {
            const row = document.createElement('div');
            row.className = 'row';
            if (p.disabled) row.classList.add('disabled');
            row.innerHTML = `
                <div class="left">
                    <img class="p-thumb" src="${p.image || 'assets/images/placeholder.jpg'}" alt="">
                    <div>
                        <div><strong>${p.name}</strong></div>
                        <div class="small-muted">${p.category || ''} • $${Number(p.price).toFixed(2)} • stock: ${p.stock ?? 0}</div>
                    </div>
                </div>
                <div class="actions">
                    <button data-id="${p.id}" class="btn edit">Edit</button>
                    <button data-id="${p.id}" class="btn toggle">${p.disabled ? 'Enable' : 'Disable'}</button>
                    <button data-id="${p.id}" class="btn danger delete">Delete</button>
                </div>
            `;
            productsListEl.appendChild(row);
        });

        // Attach button listeners
        productsListEl.querySelectorAll('.edit').forEach(btn => {
            btn.addEventListener('click', async e => {
                const id = Number(e.target.dataset.id);
                const products = await getAllProducts();
                const p = products.find(x => x.id === id);
                if (!p) return alert('Product not found');
                pId.value = p.id;
                pName.value = p.name;
                pPrice.value = p.price;
                pStock.value = p.stock ?? 0;
                pCategory.value = p.category || '';
                pDesc.value = p.description || '';
                imageBase64 = p.image || '';
                productFormTitle.textContent = 'Edit Product';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        productsListEl.querySelectorAll('.toggle').forEach(btn => {
            btn.addEventListener('click', async e => {
                const id = Number(e.target.dataset.id);
                const products = await getAllProducts();
                const p = products.find(x => x.id === id);
                if (!p) return;
                await saveProduct({ ...p, disabled: !p.disabled });
                renderProducts();
            });
        });

        productsListEl.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', async e => {
                const id = Number(e.target.dataset.id);
                if (!confirm('Delete this product?')) return;
                await deleteProduct(id);
                renderProducts();
            });
        });

    } catch (err) {
        productsListEl.innerHTML = `<div class="small-muted">Error: ${err}</div>`;
    }
}

// -------------------------
// Product Form Submit
// -------------------------
productForm.addEventListener('submit', async e => {
    e.preventDefault();
    const idVal = pId.value ? Number(pId.value) : null;

    const product = {
        name: pName.value.trim(),
        price: Number(pPrice.value) || 0,
        stock: Number(pStock.value) || 0,
        category: pCategory.value.trim(),
        image: imageBase64 || '',
        description: pDesc.value.trim()
    };

    // Validation for new products
    if (!idVal && !product.image) {
        return alert('Please select an image for the new product');
    }
    if (idVal) product.id = idVal;

    try {
        await saveProduct(product);
        productForm.reset();
        pId.value = '';
        imageBase64 = '';
        productFormTitle.textContent = 'Add Product';
        renderProducts();
        alert('Product saved');
    } catch (err) {
        console.error(err);
        alert('Error saving product');
    }
});

productCancel.addEventListener('click', () => {
    productForm.reset();
    pId.value = '';
    imageBase64 = '';
    productFormTitle.textContent = 'Add Product';
});

// -------------------------
// Render Orders
// -------------------------
async function renderOrders() {
    ordersListEl.innerHTML = '<div class="small-muted">Loading orders...</div>';
    const orders = await getOrders();
    currentOrders = orders; // Sync state

    if (!orders.length) {
        ordersListEl.innerHTML = '<p class="small-muted">No orders found.</p>';
        return;
    }
    ordersListEl.innerHTML = '';
    orders.forEach(o => {
        const row = document.createElement('div');
        const isCompleted = o.status === 'completed';
        row.className = `row ${isCompleted ? 'completed' : ''}`;
        const date = new Date(o.date).toLocaleString();
        row.innerHTML = `
            <div class="left">
                <div>
                    <strong>Order ${o.orderNumber || '—'}</strong> • 
                    <span class="small-muted">${date}</span>
                    <span class="status-badge ${isCompleted ? 'completed' : 'pending'}">
                        ${isCompleted ? 'Completed' : 'Pending'}
                    </span>
                </div>
                <div class="small-muted">${o.customer?.fullName || '—'} — ${o.shipping?.address || ''}</div>
                <div class="order-items">
                    ${(o.items || []).map(it => `<div>${it.name} × ${it.quantity} • $${(it.price * it.quantity).toFixed(2)}</div>`).join('')}
                </div>
            </div>
            <div class="actions">
                <div><strong>$${(o.total || 0).toFixed(2)}</strong></div>
                <div style="display: flex; gap: 8px;">
                    <button class="status-toggle ${isCompleted ? 'completed' : ''}" data-id="${o.id}" data-status="${o.status}">
                        ${isCompleted ? 'Mark as Pending' : 'Mark as Done'}
                    </button>
                    <button class="btn danger delete-order" data-id="${o.id}">Delete</button>
                </div>
            </div>
        `;
        ordersListEl.appendChild(row);
    });
}

// -------------------------
// Render Stats
// -------------------------
async function renderStats() {
    const orders = await getOrders();
    const now = Date.now();
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const last30 = orders.filter(o => now - new Date(o.date).getTime() <= ms30);
    const revenue = last30.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const count = last30.length;
    const aov = count === 0 ? 0 : revenue / count;

    statsRevenueEl.textContent = `$${revenue.toFixed(2)}`;
    statsOrdersEl.textContent = `${count}`;
    statsAovEl.textContent = `$${aov.toFixed(2)}`;
}

// -------------------------
// Export CSV
// -------------------------
exportBtn.addEventListener('click', async () => {
    const orders = await getOrders();
    if (!orders.length) return alert('No orders to export');

    const rows = [['orderNumber', 'date', 'total', 'customerName', 'customerEmail', 'shippingAddress', 'itemsJSON']];
    orders.forEach(o => {
        rows.push([
            o.orderNumber || '',
            o.date || '',
            o.total || 0,
            o.customer?.fullName || '',
            o.customer?.email || '',
            `${o.shipping?.address || ''}, ${o.shipping?.city || ''}, ${o.shipping?.governorate || ''}`,
            JSON.stringify(o.items || [])
        ]);
    });

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

// Initial Load
renderProducts();
renderOrders();
renderStats();
