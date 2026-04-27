const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE = `${API_URL}/api/auth`;

/**
 * Calls the backend /api/auth/logout endpoint.
 * Clears HTTP-only cookies on the server side and
 * removes any client-side auth artefacts.
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function logout() {
    try {
        const response = await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include', // send cookies
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        // Regardless of the server response, clear any local storage tokens
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');

        return data;
    } catch (error) {
        // Even if the network call fails, clear local state so the user
        // can still "log out" on the client side.
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');

        console.error('Logout error:', error);
        return { success: false, message: 'Network error during logout' };
    }
}
