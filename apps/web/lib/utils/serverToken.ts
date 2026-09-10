/*By Irfan Akbari Vuteq Indonesia - 2026-06-11*/
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Get server token from cookies for API routes
 * @param request - Optional NextRequest object
 * @returns token string or null
 */
export async function getServerToken(request?: NextRequest): Promise<string | null> {
    // Try to get from cookies (next/headers)
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get('token')?.value;

    if (cookieToken) {
        return cookieToken;
    }

    // Fallback to Authorization header if available
    if (request) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
    }

    return null;
}