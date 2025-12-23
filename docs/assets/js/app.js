// assets/js/app.js
import { updateAuthUI, initAuth } from './auth.js';
import { getProducts } from './products.js';
import { addToCart, updateCartCount, getCartItems, updateCartQuantity, removeFromCart } from './cart.js';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Auth UI
    initAuth();
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser'));
    updateAuthUI(currentUser);

    // Mobile menu
    const menuBtn = document.getElementById('menu-btn');
    const navLinks = document.getElementById('nav-links');
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    try {
        // Update cart count
        await updateCartCount();

        // Load products if on a product page
        const productGrids = document.querySelectorAll('.products-grid');
        if (productGrids.length > 0) {
            await loadProducts();

            // Filter/Sort listeners
            const categoryFilter = document.getElementById('category-filter');
            const sortBy = document.getElementById('sort-by');

            if (categoryFilter) {
                categoryFilter.addEventListener('change', () => {
                    loadProducts(categoryFilter.value, sortBy ? sortBy.value : null);
                });
            }

            if (sortBy) {
                sortBy.addEventListener('change', () => {
                    loadProducts(categoryFilter ? categoryFilter.value : null, sortBy.value);
                });
            }
        }

        // Initialize cart page if present
        if (document.getElementById('cart-items')) {
            await renderCartPage();
        }

        // Add to cart delegation
        document.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-cart')) {
                e.preventDefault();
                const btn = e.target.closest('.add-to-cart');
                const productId = parseInt(btn.dataset.productId);
                let quantity = 1;
                const scope = btn.closest('div') || document;
                const qtyInput = scope.querySelector('.quantity-input');
                if (qtyInput) {
                    const q = parseInt(qtyInput.value);
                    if (!isNaN(q) && q > 0) quantity = q;
                }
                if (productId) {
                    addToCart(productId, quantity).then(() => {
                        // success
                    });
                }
            }
        });

        // Filter/Sort listeners... (Removed for brevity, but can be re-added if needed)

    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

async function loadProducts(category = null, sortBy = null) {
    try {
        const products = await getProducts(category);
        const containers = document.querySelectorAll('.products-grid');

        if (containers.length === 0) return;

        // Sort products client-side
        if (sortBy) {
            products.sort((a, b) => {
                if (sortBy === 'price-asc') return a.price - b.price;
                if (sortBy === 'price-desc') return b.price - a.price;
                if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
                if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
                return 0;
            });
        }

        if (products.length === 0) {
            containers.forEach(container => {
                container.innerHTML = '<p class="no-products">No products found for this category.</p>';
            });
            return;
        }

        const html = products.map(product => `
            <div class="product-card">
                <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 200px; object-fit: cover;">
                <div class="product-info" style="padding: 1rem;">
                    <h3>${product.name}</h3>
                    <p class="price" style="color: #e74c3c; font-weight: 600;">$${product.price ? product.price.toFixed(2) : '0.00'}</p>
                    <button class="btn add-to-cart" data-product-id="${product.id}" type="button" style="width: 100%; margin-top: 1rem;">
                        Add to Cart
                    </button>
                </div>
            </div>
        `).join('');

        containers.forEach(container => {
            container.innerHTML = html;
        });
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

async function renderCartPage() {
    const container = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('subtotal');
    const totalEl = document.getElementById('total');
    if (!container) return;

    try {
        const items = await getCartItems();

        if (!items || items.length === 0) {
            container.innerHTML = `
                <div class="empty-cart">
                    <p>Your cart is empty</p>
                    <a href="products.html" class="btn">Continue Shopping</a>
                </div>`;
            if (subtotalEl) subtotalEl.textContent = '$0.00';
            if (totalEl) totalEl.textContent = '$0.00';
            return;
        }

        let subtotal = 0;
        const html = items.map(item => {
            // item already includes product details from the API join
            const line = item.price * item.quantity;
            subtotal += line;
            return `
            <div class="cart-item" data-id="${item.id}" data-product-id="${item.productId}">
                <img src="${item.image}" alt="${item.name}" class="cart-item-image" style="width: 80px; height: 80px; object-fit: cover; margin-right: 1rem;" />
                <div class="cart-item-details" style="flex: 1;">
                    <h3>${item.name}</h3>
                    <p class="price">$${item.price.toFixed(2)}</p>
                    <div class="quantity-controls" style="margin: 0.5rem 0;">
                        <input type="number" class="qty-input" min="1" value="${item.quantity}" style="width: 50px;" />
                    </div>
                </div>
                <div class="actions">
                     <button class="btn btn-outline remove-item" style="color: red; border-color: red;">Remove</button>
                     <div class="line-total" style="font-weight: bold;">$${line.toFixed(2)}</div>
                </div>
            </div>`;
        }).join('');

        container.innerHTML = html;
        if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
        if (totalEl) totalEl.textContent = `$${subtotal.toFixed(2)}`;

        // Helper to update UI line total
        const updateLineTotal = (itemEl, price, qty) => {
            const lineTotal = itemEl.querySelector('.line-total');
            lineTotal.textContent = `$${(price * qty).toFixed(2)}`;
        };

        // Events
        container.onchange = async (e) => {
            if (e.target.classList.contains('qty-input')) {
                const itemEl = e.target.closest('.cart-item');
                const id = itemEl.dataset.id; // cart item id
                const price = parseFloat(itemEl.querySelector('.price').textContent.replace('$', ''));
                const qty = parseInt(e.target.value);

                if (qty > 0) {
                    updateLineTotal(itemEl, price, qty);
                    await updateCartQuantity(id, qty);
                    // refresh whole cart to get correct totals is safest, or just update totals manually
                    await renderCartPage();
                }
            }
        };

        container.onclick = async (e) => {
            if (e.target.classList.contains('remove-item')) {
                const itemEl = e.target.closest('.cart-item');
                const id = itemEl.dataset.id;
                await removeFromCart(id);
                await renderCartPage();
            }
        };

    } catch (err) {
        console.error("Error rendering cart:", err);
    }
}
