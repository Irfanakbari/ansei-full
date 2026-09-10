/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

import { NextResponse } from 'next/server';
import { createTokenCookie } from '../_lib/cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://10.10.10.10:7500';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Ambil IP dan User-Agent dari client request
        const forwardedFor = request.headers.get('x-forwarded-for');
        const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'Unknown';
        const userAgent = request.headers.get('user-agent') || 'Unknown';

        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-real-ip': clientIp,
                'x-user-agent': userAgent,
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { message: data.message || 'Login failed' },
                { status: response.status }
            );
        }

        // Set httpOnly cookie with token
        const cookie = createTokenCookie(data.AccessToken);
        const nextResponse = NextResponse.json(data);
        nextResponse.cookies.set(cookie);

        return nextResponse;
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
