import { api } from './api.js';

async function getProducts(category = null) {
    try {
        const endpoint = category ? `/products?category=${category}` : '/products';
        const products = await api.get(endpoint);
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

const getProductById = async (id) => {
    try {
        return await api.get(`/products/${id}`);
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
};

// Seed function not needed on docs anymore
const seedProducts = async () => { };

export { getProducts, getProductById, seedProducts };