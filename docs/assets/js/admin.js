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
                const newStatus = getNextStatus(currentStatus);
                
                try {
                    const response = await fetch(`/api/orders/${id}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ status: newStatus })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        showNotification(`Order status updated to ${newStatus}${result.message.includes('customer notified') ? ' and customer notified' : ''}`);
                        renderOrders();
                    } else {
                        throw new Error(result.error || 'Failed to update status');
                    }
                } catch (err) {
                    console.error('Error updating status:', err);
                    alert('Failed to update order status: ' + err.message);
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
const pDiscount = document.getElementById('p-discount');
const pOriginalPrice = document.getElementById('p-original-price');
const productFormTitle = document.getElementById('product-form-title');
const productCancel = document.getElementById('product-cancel');
const colorsContainer = document.getElementById('colors-container');
const addColorBtn = document.getElementById('add-color-btn');

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
// Order Status Management
// -------------------------
function getNextStatus(currentStatus) {
    const statusFlow = {
        'pending': 'processing',
        'processing': 'shipped',
        'shipped': 'delivered',
        'delivered': 'pending' // Allow cycling back for flexibility
    };
    return statusFlow[currentStatus] || 'pending';
}

function getStatusBadgeClass(status) {
    const statusClasses = {
        'pending': 'pending',
        'processing': 'processing',
        'shipped': 'shipped',
        'delivered': 'delivered'
    };
    return statusClasses[status] || 'pending';
}

function getStatusButtonText(status) {
    const buttonText = {
        'pending': 'Start Processing',
        'processing': 'Mark as Shipped',
        'shipped': 'Mark as Delivered',
        'delivered': 'Reset to Pending'
    };
    return buttonText[status] || 'Start Processing';
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
// Image Base64 storage with compression
// -------------------------
let imageBase64 = '';

// Compress image before converting to base64
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

pImage.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const compressedBlob = await compressImage(file);
        const reader = new FileReader();
        reader.onload = () => imageBase64 = reader.result;
        reader.readAsDataURL(compressedBlob);
    } catch (err) {
        console.error('Error compressing image:', err);
        // Fallback to original file
        const reader = new FileReader();
        reader.onload = () => imageBase64 = reader.result;
        reader.readAsDataURL(file);
    }
});

// -------------------------
// Discount calculation
// -------------------------
pDiscount.addEventListener('input', () => {
    const price = parseFloat(pPrice.value) || 0;
    const discount = parseFloat(pDiscount.value) || 0;

    if (discount > 0 && price > 0) {
        const originalPrice = price / (1 - discount / 100);
        pOriginalPrice.value = originalPrice.toFixed(2);
    } else {
        pOriginalPrice.value = '';
    }
});

pPrice.addEventListener('input', () => {
    const price = parseFloat(pPrice.value) || 0;
    const discount = parseFloat(pDiscount.value) || 0;

    if (discount > 0 && price > 0) {
        const originalPrice = price / (1 - discount / 100);
        pOriginalPrice.value = originalPrice.toFixed(2);
    }
});

// -------------------------
// Color Management
// -------------------------
let colorCounter = 0;

// Function to calculate total stock from color variants
function calculateTotalStock() {
    const colorInputs = colorsContainer.querySelectorAll('.color-input-group');
    let totalStock = 0;
    colorInputs.forEach(colorDiv => {
        const stockInput = colorDiv.querySelector('.color-stock');
        totalStock += parseInt(stockInput.value) || 0;
    });
    pStock.value = totalStock;
}

function addColorInput(color = null) {
    const colorId = color?.id || `temp-${colorCounter++}`;
    const colorDiv = document.createElement('div');
    colorDiv.className = 'color-input-group';
    colorDiv.dataset.colorId = colorId;
    // Store existing image if editing
    if (color?.image) {
        colorDiv.dataset.existingImage = color.image;
    }
    colorDiv.innerHTML = `
        <input type="text" placeholder="Color Name" class="color-name" value="${color?.colorName || ''}" required>
        <input type="color" class="color-code" value="${color?.colorCode || '#000000'}" title="Color Code">
        <input type="number" step="0.01" placeholder="Price" class="color-price" value="${color?.price || ''}" required>
        <input type="number" placeholder="Stock" class="color-stock" value="${color?.stock || 0}" required>
        <label>Image <input type="file" accept="image/*" class="color-image" title="Variant Image"></label>
        <img class="color-image-preview" src="${color?.image || ''}" style="max-width:50px; margin-top:4px; display:${color?.image ? 'block' : 'none'};" />
        <button type="button" class="btn danger remove-color">Remove</button>
    `;

    // Add event listener to stock input to recalculate total
    const stockInput = colorDiv.querySelector('.color-stock');
    stockInput.addEventListener('input', calculateTotalStock);

    // Handle preview update on file selection
    const fileInput = colorDiv.querySelector('.color-image');
    const previewImg = colorDiv.querySelector('.color-image-preview');
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedBlob = await compressImage(file, 400, 400, 0.8);
                const reader = new FileReader();
                reader.onload = () => {
                    previewImg.src = reader.result;
                    previewImg.style.display = 'block';
                    // Store compressed base64 for submission
                    colorDiv.dataset.existingImage = reader.result;
                };
                reader.readAsDataURL(compressedBlob);
            } catch (err) {
                console.error('Error compressing color image:', err);
                // Fallback to original
                const reader = new FileReader();
                reader.onload = () => {
                    previewImg.src = reader.result;
                    previewImg.style.display = 'block';
                    colorDiv.dataset.existingImage = reader.result;
                };
                reader.readAsDataURL(file);
            }
        } else {
            previewImg.style.display = 'none';
            delete colorDiv.dataset.existingImage;
        }
    });

    colorDiv.querySelector('.remove-color').addEventListener('click', () => {
        colorDiv.remove();
        calculateTotalStock(); // Recalculate when removing a color
    });

    colorsContainer.appendChild(colorDiv);
    
    // Calculate total stock after adding new color
    calculateTotalStock();
}

addColorBtn.addEventListener('click', () => addColorInput());

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
                        <div class="small-muted">${p.category || ''} • ${Number(p.price).toFixed(2)} EGP • stock: ${p.stock ?? 0}</div>
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
                pDiscount.value = p.discount || 0;
                pOriginalPrice.value = p.originalPrice || '';
                imageBase64 = p.image || '';

                // Load colors
                colorsContainer.innerHTML = '';
                if (p.colors && p.colors.length > 0) {
                    p.colors.forEach(color => addColorInput(color));
                    // Calculate total stock after loading colors
                    calculateTotalStock();
                } else {
                    addColorInput(); // Add one empty color input
                }

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

    // Helper to convert a File to compressed base64 data URL
    async function fileToBase64(file) {
        try {
            const compressedBlob = await compressImage(file, 400, 400, 0.8);
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = err => reject(err);
                reader.readAsDataURL(compressedBlob);
            });
        } catch (err) {
            console.error('Error compressing image in form submission:', err);
            // Fallback to original file
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = err => reject(err);
                reader.readAsDataURL(file);
            });
        }
    }

    // Collect colors (updated to handle variant images)
    const colorInputs = colorsContainer.querySelectorAll('.color-input-group');
    const colors = [];
    
    for (const colorDiv of colorInputs) {
        const colorName = colorDiv.querySelector('.color-name').value.trim();
        const colorCode = colorDiv.querySelector('.color-code').value;
        const colorPrice = parseFloat(colorDiv.querySelector('.color-price').value);
        const colorStock = parseInt(colorDiv.querySelector('.color-stock').value) || 0;
        let imageData = '';
        const fileInput = colorDiv.querySelector('.color-image');
        if (fileInput && fileInput.files.length > 0) {
            imageData = await fileToBase64(fileInput.files[0]);
        } else if (colorDiv.dataset.existingImage) {
            imageData = colorDiv.dataset.existingImage;
        }
        if (colorName && colorPrice) {
            colors.push({
                colorName,
                colorCode,
                price: colorPrice,
                stock: colorStock,
                image: imageData
            });
        }
    }

    if (colors.length === 0) {
        return alert('Please add at least one color variant');
    }

    const product = {
        name: pName.value.trim(),
        price: Number(pPrice.value) || 0,
        stock: Number(pStock.value) || 0, // This is now calculated from color variants
        category: pCategory.value.trim(),
        image: imageBase64 || '',
        description: pDesc.value.trim(),
        discount: Number(pDiscount.value) || 0,
        originalPrice: pOriginalPrice.value ? Number(pOriginalPrice.value) : null,
        colors: colors
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
        pDiscount.value = 0;
        pOriginalPrice.value = '';
        colorsContainer.innerHTML = '';
        addColorInput(); // Add one empty color input
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
    pDiscount.value = 0;
    pOriginalPrice.value = '';
    colorsContainer.innerHTML = '';
    addColorInput(); // Add one empty color input
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
        const statusBadgeClass = getStatusBadgeClass(o.status);
        const statusButtonText = getStatusButtonText(o.status);
        row.className = `row status-${o.status}`;
        const date = new Date(o.date).toLocaleString();
        row.innerHTML = `
            <div class="left">
                <div>
                    <strong>Order ${o.orderNumber || '—'}</strong> • 
                    <span class="small-muted">${date}</span>
                    <span class="status-badge ${statusBadgeClass}">
                        ${o.status || 'pending'}
                    </span>
                </div>
                <div class="small-muted">${o.customer?.fullName || '—'} — ${o.shipping?.address || ''}</div>
                <div class="order-items">
                    ${(o.items || []).map(it => `<div>${it.name} × ${it.quantity} • $${(it.price * it.quantity).toFixed(2)}${it.colorName ? ` (${it.colorName})` : ''}</div>`).join('')}
                </div>
                ${o.trackingNumber ? `<div class="small-muted"><strong>Tracking:</strong> ${o.trackingNumber}</div>` : ''}
                ${o.estimatedDelivery ? `<div class="small-muted"><strong>Est. Delivery:</strong> ${new Date(o.estimatedDelivery).toLocaleDateString()}</div>` : ''}
            </div>
            <div class="actions">
                <div><strong>$${(o.total || 0).toFixed(2)}</strong></div>
                <div style="display: flex; gap: 8px;">
                    <button class="status-toggle" data-id="${o.id}" data-status="${o.status}">
                        ${statusButtonText}
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
addColorInput(); // Add initial color input
renderProducts();
renderOrders();
renderStats();
