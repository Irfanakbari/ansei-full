/*By Irfan Akbari Vuteq Indonesia - 2026-04-03 - Updated 2026-06-16*/

async function clearAuthenticationState(): Promise<void> {
    const [{store}, {clearAuth}] = await Promise.all([
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
    // Prepare headers with token if available
    const headers: Record<string, string> = {
        ...(options?.headers as Record<string, string>),
    };

    delete headers.Authorization;
    delete headers.authorization;

    // SSO access tokens are server-side only. Route legacy slice calls through
    // the authenticated BFF proxy instead of expecting the browser to provide
    // an Authorization header.
    const requestUrl = new URL(url, window.location.origin);
    const pathWithoutBase = requestUrl.pathname.startsWith('/ansei/')
        ? requestUrl.pathname.slice('/ansei'.length)
        : requestUrl.pathname;
    const preservedRoutePrefixes = [
        '/api/auth/',
        '/api/display',
        '/api/frontend/',
        '/api/production/forecast/import',
        '/api/system-administration/stock-transaction-log/export',
        '/api/warehouse/inventory-counting/generate-snapshot',
        '/api/warehouse/inventory-counting/generate-ws',
        '/api/warehouse/mrp/export',
        '/api/warehouse/transfer-material/',
    ];
    const isLegacyApiRoute = pathWithoutBase.startsWith('/api/') &&
        !pathWithoutBase.startsWith('/api/proxy/') &&
        !preservedRoutePrefixes.some((prefix) => pathWithoutBase.startsWith(prefix));
    const targetUrl = isLegacyApiRoute
        ? `/ansei/api/proxy/v1${pathWithoutBase.slice('/api'.length)}${requestUrl.search}`
        : `/ansei${pathWithoutBase}${requestUrl.search}`;

    const response = await fetch(targetUrl, {
        ...options,
        headers,
        credentials: 'include', // Important: include SSO session cookie
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
            window.location.href = '/ansei/?sessionExpired=true';
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
            window.location.href = '/ansei/?sessionExpired=true';
        }
    }

    return response;
}
