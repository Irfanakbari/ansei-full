/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

/**
 * Client-side token utilities for httpOnly cookie based authentication
 */

/**
 * Get token from httpOnly cookie via API route
 * Since httpOnly cookies cannot be accessed by JavaScript directly,
 * we need to use a server action or API route to read it
 */
export async function getTokenFromCookie(): Promise<string | null> {
    try {
        const response = await fetch('/ansei/api/auth/token', {
            method: 'GET',
            credentials: 'include', // Important: include cookies in request
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.token || null;
    } catch (error) {
        console.error('Failed to get token from cookie:', error);
        return null;
    }
}

/**
 * Check if user is authenticated by checking for token cookie
 */
export async function isAuthenticated(): Promise<boolean> {
    const token = await getTokenFromCookie();
    return token !== null;
}