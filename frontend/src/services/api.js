/**
 * api.js — Centralized fetch client for FoodBridge Frontend.
 */

// ✅ Environment-based API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ✅ Build base once
const API_BASE = `${API_URL}/api`;

export async function fetchWithAuth(endpoint, options = {}) {
    const fetchOptions = {
        ...options,
        credentials: options.credentials || 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    };

    let response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

    if (response.status === 401) {
        try {
            const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
            });

            if (refreshResponse.ok) {
                response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
            } else {
                throw new Error("Session expired. Please log in again.");
            }
        } catch (error) {
            localStorage.clear();
            window.location.href = '/login';
        }
    }

    return response;
}