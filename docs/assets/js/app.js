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

            // Populate color filter dynamically
            await populateColorFilter();

            // Filter/Sort listeners
            const categoryFilter = document.getElementById('category-filter');
            const colorFilter = document.getElementById('color-filter');
            const sortBy = document.getElementById('sort-by');
            const searchInput = document.getElementById('search-input');
            const searchBtn = document.getElementById('search-btn');

            if (categoryFilter) {
                categoryFilter.addEventListener('change', () => {
                    loadProducts(categoryFilter.value, colorFilter ? colorFilter.value : null, sortBy ? sortBy.value : null, searchInput ? searchInput.value : null);
                });
            }

            if (colorFilter) {
                colorFilter.addEventListener('change', () => {
                    loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter.value, sortBy ? sortBy.value : null, searchInput ? searchInput.value : null);
                });
            }

            if (sortBy) {
                sortBy.addEventListener('change', () => {
                    loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter ? colorFilter.value : null, sortBy.value, searchInput ? searchInput.value : null);
                });
            }

            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter ? colorFilter.value : null, sortBy ? sortBy.value : null, searchInput.value);
                });
                
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter ? colorFilter.value : null, sortBy ? sortBy.value : null, searchInput.value);
                    }
                });
            }

            if (searchBtn) {
                searchBtn.addEventListener('click', () => {
                    loadProducts(categoryFilter ? categoryFilter.value : null, colorFilter ? colorFilter.value : null, sortBy ? sortBy.value : null, searchInput ? searchInput.value : null);
                });
            }
        }

        // Load product slider if on index page
        const productSlider = document.getElementById('product-slider');
        if (productSlider) {
            await loadProductSlider();
            initSliderControls();
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

    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

// Populate color filter with available colors from products
async function populateColorFilter() {
    try {
        const products = await getProducts(); // Get all products
        const colorSet = new Set(); // Use Set to avoid duplicates
        
        // Collect all unique colors from all products
        products.forEach(product => {
            if (product.colors && product.colors.length > 0) {
                product.colors.forEach(color => {
                    if (color.colorName) {
                        colorSet.add(color.colorName.trim());
                    }
                });
            }
        });
        
        // Get the color filter select element
        const colorFilter = document.getElementById('color-filter');
        if (!colorFilter) return;
        
        // Clear existing options except "All Colors"
        colorFilter.innerHTML = '<option value="">All Colors</option>';
        
        // Sort colors alphabetically and add them to the filter
        const sortedColors = Array.from(colorSet).sort();
        sortedColors.forEach(color => {
            const option = document.createElement('option');
            option.value = color.toLowerCase();
            option.textContent = color;
            colorFilter.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error populating color filter:', error);
    }
}

async function loadProducts(category = null, color = null, sortBy = null, searchQuery = null) {
    try {
        const products = await getProducts(category);
        const containers = document.querySelectorAll('.products-grid');

        if (containers.length === 0) return;

        // Filter products based on search query
        let filteredProducts = products;
        if (searchQuery && searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase().trim();
            filteredProducts = products.filter(product => {
                const nameMatch = product.name.toLowerCase().includes(query);
                const categoryMatch = product.category && product.category.toLowerCase().includes(query);
                const descriptionMatch = product.description && product.description.toLowerCase().includes(query);
                return nameMatch || categoryMatch || descriptionMatch;
            });
        }

        // Filter products by color
        if (color && color.trim() !== '') {
            const colorQuery = color.toLowerCase().trim();
            filteredProducts = filteredProducts.filter(product => {
                if (!product.colors || product.colors.length === 0) return false;
                
                // Check if any color matches the filter
                return product.colors.some(productColor => {
                    const colorName = productColor.colorName ? productColor.colorName.toLowerCase() : '';
                    return colorName.includes(colorQuery);
                });
            });
        }

        // Sort products client-side
        if (sortBy) {
            filteredProducts.sort((a, b) => {
                if (sortBy === 'price-asc') return a.price - b.price;
                if (sortBy === 'price-desc') return b.price - a.price;
                if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
                if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
                return 0;
            });
        }

        if (filteredProducts.length === 0) {
            containers.forEach(container => {
                container.innerHTML = '<p class="no-products">No products found matching your criteria.</p>';
            });
            return;
        }

        const html = filteredProducts.map(product => {
            const hasDiscount = product.discount && product.discount > 0;
            const hasColors = product.colors && product.colors.length > 0;

            // Calculate total stock from all colors
            const totalStock = hasColors
                ? product.colors.reduce((sum, color) => sum + (color.stock || 0), 0)
                : product.stock || 0;

            // Determine stock badge
            let stockBadgeClass = 'out-of-stock';
            let stockBadgeText = 'Out of Stock';
            if (totalStock > 10) {
                stockBadgeClass = 'in-stock';
                stockBadgeText = 'In Stock';
            } else if (totalStock > 0) {
                stockBadgeClass = 'low-stock';
                stockBadgeText = `Only ${totalStock} left`;
            }

            return `
                <div class="product-card">
                    <span class="stock-badge ${stockBadgeClass}">${stockBadgeText}</span>
                    <div class="product-image-container">
                        <img src="${product.image}" alt="${product.name}" onclick="window.location.href='product-detail.html?id=${product.id}'">
                        <button class="share-btn" onclick="shareProduct(${product.id}, '${product.name}')" title="Share product">
                            <i class="ri-share-line"></i>
                        </button>
                    </div>
                    <div class="product-info">
                        ${product.category ? `<p class="category">${product.category}</p>` : ''}
                        <h3 onclick="window.location.href='product-detail.html?id=${product.id}'">${product.name}</h3>
                        
                        <div class="price-container">
                            ${hasDiscount ? `
                                <span class="original-price">$${product.originalPrice.toFixed(2)}</span>
                                <span class="price">$${product.price.toFixed(2)}</span>
                                
                            ` : `
                                <span class="price">$${product.price ? product.price.toFixed(2) : '0.00'}</span>
                            `}
                        </div>

                        ${hasColors ? `
                            <div class="color-preview">
                                ${product.colors.slice(0, 5).map(color => `
                                    <div 
                                        class="color-dot" 
                                        style="background-color: ${color.colorCode}; ${color.colorCode === '#FFFFFF' || color.colorCode === '#ffffff' ? 'border-color: #999;' : ''}"
                                        title="${color.colorName}"
                                    ></div>
                                `).join('')}
                                ${product.colors.length > 5 ? `<span style="font-size: 0.85rem; color: #666;">+${product.colors.length - 5} more</span>` : ''}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

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
            
            // Use color-specific image if available, otherwise main product image
            const displayImage = item.colorImage || item.image;
            const colorDisplay = item.colorName ? `<p class="color-info">Color: ${item.colorName}</p>` : '';
            
            return `
            <div class="cart-item" data-id="${item.id}" data-product-id="${item.productId}">
                <img src="${displayImage}" alt="${item.name}" class="cart-item-image" style="width: 80px; height: 80px; object-fit: cover; margin-right: 1rem;" />
                <div class="cart-item-details" style="flex: 1;">
                    <h3>${item.name}</h3>
                    ${colorDisplay}
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

// Product Slider Functions
async function loadProductSlider() {
    try {
        const products = await getProducts();
        const slider = document.getElementById('product-slider');
        if (!slider) return;

        // Create slider items for all product color variants
        const sliderItems = [];
        
        products.forEach(product => {
            if (product.colors && product.colors.length > 0) {
                // Add each color variant as a separate slider item
                product.colors.forEach(color => {
                    sliderItems.push({
                        ...product,
                        selectedColor: color,
                        displayImage: color.image || product.image,
                        displayPrice: color.price || product.price,
                        colorName: color.colorName,
                        colorCode: color.colorCode,
                        stock: color.stock || 0
                    });
                });
            } else {
                // Add product without color variants
                sliderItems.push({
                    ...product,
                    selectedColor: null,
                    displayImage: product.image,
                    displayPrice: product.price,
                    colorName: null,
                    colorCode: null,
                    stock: product.stock || 0
                });
            }
        });

        if (sliderItems.length === 0) {
            slider.innerHTML = '<p class="no-products">No products available.</p>';
            return;
        }

        const html = sliderItems.map(item => {
            const hasDiscount = item.discount && item.discount > 0;
            const isOutOfStock = item.stock <= 0;
            
            return `
                <div class="slider-product-card" onclick="window.location.href='product-detail.html?id=${item.id}${item.selectedColor ? '&color=' + item.selectedColor.id : ''}'">
                    <img src="${item.displayImage}" alt="${item.name}">
                    <div class="product-info">
                        <h3>${item.name}</h3>
                        ${item.colorName ? `
                            <div class="color-info">
                                <div class="color-dot" style="background-color: ${item.colorCode}; ${item.colorCode === '#FFFFFF' || item.colorCode === '#ffffff' ? 'border-color: #999;' : ''}"></div>
                                <span>${item.colorName}</span>
                            </div>
                        ` : ''}
                        <div class="price">
                            ${hasDiscount ? `
                                <span class="original-price">$${item.originalPrice ? item.originalPrice.toFixed(2) : ''}</span>
                                <span class="decreased">$${item.displayPrice.toFixed(2)}</span>
                            ` : `$${item.displayPrice.toFixed(2)}`}
                        </div>
                        ${isOutOfStock ? '<span class="out-of-stock">Out of Stock</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');

        slider.innerHTML = html;
    } catch (error) {
        console.error('Error loading product slider:', error);
    }
}

function initSliderControls() {
    const slider = document.getElementById('product-slider');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    
    if (!slider || !prevBtn || !nextBtn) return;

    const scrollAmount = 300; // Adjust scroll amount as needed

    prevBtn.addEventListener('click', () => {
        slider.scrollBy({
            left: -scrollAmount,
            behavior: 'smooth'
        });
    });

    nextBtn.addEventListener('click', () => {
        slider.scrollBy({
            left: scrollAmount,
            behavior: 'smooth'
        });
    });

    // Optional: Auto-scroll functionality
    let autoScrollInterval;
    let isPaused = false;

    const startAutoScroll = () => {
        if (!isPaused) {
            autoScrollInterval = setInterval(() => {
                if (slider.scrollLeft >= slider.scrollWidth - slider.clientWidth) {
                    slider.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    slider.scrollBy({ left: 150, behavior: 'smooth' });
                }
            }, 3000);
        }
    };

    const stopAutoScroll = () => {
        clearInterval(autoScrollInterval);
    };

    // Pause auto-scroll on hover
    slider.addEventListener('mouseenter', () => {
        isPaused = true;
        stopAutoScroll();
    });

    slider.addEventListener('mouseleave', () => {
        isPaused = false;
        startAutoScroll();
    });

    // Start auto-scroll
    startAutoScroll();
}

// Share product function
function shareProduct(productId, productName) {
    event.stopPropagation();
    
    const productUrl = `${window.location.origin}/product-detail.html?id=${productId}`;
    const shareText = `Check out this ${productName} from FASHION Store!`;
    
    // Check if Web Share API is available
    if (navigator.share) {
        navigator.share({
            title: productName,
            text: shareText,
            url: productUrl
        }).catch(err => console.log('Error sharing:', err));
    } else {
        // Fallback for desktop browsers
        copyToClipboard(productUrl);
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Link copied to clipboard!');
    });
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'share-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}
