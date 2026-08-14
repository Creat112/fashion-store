// assets/js/api.js
const API_BASE = '/api';

export const api = {
    async get(endpoint) {
        const res = await fetch(`${API_BASE}${endpoint}`);
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error || `API Error: ${res.statusText}`);
        return result;
    },

    async post(endpoint, data) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'API Error');
        return result;
    },

    async put(endpoint, data) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'API Error');
        return result;
    },

    async delete(endpoint) {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('API Error');
        return res.json();
    }
};
