/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { TOKEN_COOKIE_NAME } from '../_lib/cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://10.10.10.10:7500';

export async function GET() {
    try {
        // Get token from httpOnly cookie
        const cookieStore = await cookies();
        const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

        if (!tokenCookie) {
            return NextResponse.json(
                { message: 'Missing Authorization token' },
                { status: 401 }
            );
        }

        const token = tokenCookie.value;

        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { message: data.message || 'Failed to fetch profile' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}