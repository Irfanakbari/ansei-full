/*By Irfan Akbari Vuteq Indonesia - 2026-09-09*/

import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE_NAME } from '../../auth/_lib/cookie';
import { type ApiVersion, getApiUrl } from '@/lib/config';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const API_VERSION_PATTERN = /^v\d+$/;

async function handler(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> }
) {
    if (!ALLOWED_METHODS.has(request.method)) {
        return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
    }

    const { path } = await context.params;
    const [version, ...segments] = path;
    if (!version || !API_VERSION_PATTERN.test(version) || segments.length === 0) {
        return NextResponse.json({ message: 'Invalid API path' }, { status: 400 });
    }

    const token = (await cookies()).get(ACCESS_TOKEN_COOKIE_NAME)?.value;
    if (!token) {
        return NextResponse.json({ message: 'No token found' }, { status: 401 });
    }

    const backendUrl = new URL(
        `${getApiUrl(version as ApiVersion)}/${segments.map(encodeURIComponent).join('/')}`
    );
    backendUrl.search = request.nextUrl.search;

    const headers = new Headers();
    const contentType = request.headers.get('content-type');
    const accept = request.headers.get('accept');

    if (contentType) {
        headers.set('content-type', contentType);
    }

    if (accept) {
        headers.set('accept', accept);
    }

    headers.set('authorization', `Bearer ${token}`);

    const body = request.method === 'GET' ? undefined : await request.arrayBuffer();
    let response: Response;
    try {
        response = await fetch(backendUrl, {
            method: request.method,
            headers,
            body,
            redirect: 'manual',
        });
    } catch {
        process.stderr.write(`${JSON.stringify({
            level: 'error',
            event: 'api_proxy_backend_unavailable',
            requestId: crypto.randomUUID(),
            method: request.method,
            path: `/${segments.join('/')}`,
            backendHost: backendUrl.host,
        })}\n`);

        return NextResponse.json(
            { message: 'Backend service is unavailable' },
            { status: 502 }
        );
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('set-cookie');

    return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
    });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
