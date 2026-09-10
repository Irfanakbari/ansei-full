/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TOKEN_COOKIE_NAME } from '../_lib/cookie';

/**
 * GET /api/auth/token
 * Returns the token from httpOnly cookie (for internal use only)
 * This route is called by the client to get the token for API calls
 */
export async function GET() {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_COOKIE_NAME);

    if (!token) {
        return NextResponse.json(
            { message: 'No token found' },
            { status: 401 }
        );
    }

    return NextResponse.json({ token: token.value });
}
