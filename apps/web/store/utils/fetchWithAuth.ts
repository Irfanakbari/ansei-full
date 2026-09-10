/*By Irfan Akbari Vuteq Indonesia - 2026-04-03 - Updated 2026-06-16*/

import { getTokenFromCookie } from '@/app/api/auth/_lib/token-client';

async function clearAuthenticationState(): Promise<void> {
    const [{ store }, { clearAuth }] = await Promise.all([
        import('@/store'),
        import('@/store/features/auth/authSlice'),
    ]);

    store.dispatch(clearAuth());
}

/**
 * Fetch with automatic 401 handling for httpOnly cookie-based auth
 * This wrapper automatically reads the token from httpOnly cookie
 */
export async function fetchWithAuth(
    url: string,
    options?: RequestInit
): Promise<Response> {
    // Get token from httpOnly cookie
    const token = await getTokenFromCookie();

    // Prepare headers with token if available
    const headers: Record<string, string> = {
        ...(options?.headers as Record<string, string>),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // Important: include cookies in request
    });

    if (response.status === 401) {
        // Check if already processing 401 to prevent loop
        const alreadyProcessing = typeof window !== 'undefined'
            ? sessionStorage.getItem('processing401')
            : null;

        if (alreadyProcessing) {
            return response;
        }

        if (typeof window !== 'undefined') {
            // Set flag to prevent multiple 401 handling
            sessionStorage.setItem('processing401', 'true');

            // Load the store only after a 401 response to avoid an auth-slice/store import cycle.
            await clearAuthenticationState();

            // Clear the flag after navigation
            setTimeout(() => {
                sessionStorage.removeItem('processing401');
            }, 1000);

            // Navigate to login with sessionExpired flag
            window.location.href = '/?sessionExpired=true';
        }
    }

    return response;
}

/**
 * Fetch with explicit token (for when you already have the token)
 */
export async function fetchWithToken(
    url: string,
    token: string,
    options?: RequestInit
): Promise<Response> {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(options?.headers as Record<string, string>),
            'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
    });

    if (response.status === 401) {
        await clearAuthenticationState();
        if (typeof window !== 'undefined') {
            window.location.href = '/?sessionExpired=true';
        }
    }

    return response;
}
