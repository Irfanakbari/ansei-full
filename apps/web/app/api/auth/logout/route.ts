/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

import { NextResponse } from 'next/server';
import { deleteTokenCookie } from '../_lib/cookie';

export async function POST() {
    const cookie = deleteTokenCookie();
    const response = NextResponse.json({ success: true });
    response.cookies.set(cookie);

    return response;
}
