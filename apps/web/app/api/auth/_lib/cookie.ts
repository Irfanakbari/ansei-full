/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

import { NextResponse } from 'next/server';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

// Cookie configuration
export const TOKEN_COOKIE_NAME = 'ips_token';
export const ACCESS_TOKEN_COOKIE_NAME = 'ips_token';
export const TOKEN_COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds
export const ACCESS_TOKEN_COOKIE_MAX_AGE = TOKEN_COOKIE_MAX_AGE;

// Cookie options
const cookieOptions: Partial<ResponseCookie> = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_COOKIE_MAX_AGE,
    path: '/',
};

/**
 * Create httpOnly cookie for token
 */
export function createTokenCookie(token: string, maxAge: number = TOKEN_COOKIE_MAX_AGE): ResponseCookie {
    return {
        name: TOKEN_COOKIE_NAME,
        value: token,
        ...cookieOptions,
        maxAge: Math.max(1, maxAge),
    };
}

export const createAccessTokenCookie = createTokenCookie;

/**
 * Create cookie deletion option
 */
export function deleteTokenCookie(): ResponseCookie {
    return {
        name: TOKEN_COOKIE_NAME,
        value: '',
        maxAge: 0,
        path: '/',
    };
}

export function clearAuthCookies(response: NextResponse): NextResponse {
    response.cookies.set(deleteTokenCookie());
    return response;
}
