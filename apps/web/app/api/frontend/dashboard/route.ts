/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */

import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';
import { sso } from '@/lib/sso';

export async function GET(request: Request) {
    try {
        const response = await sso.fetch(
            request,
            new URL(`${getApiUrl('v1')}/frontend/dashboard`),
            {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
            },
        );

        const data = await response.json();
        if (!response.ok) {
            console.error(JSON.stringify({
                event: 'dashboard_backend_response_failed',
                status: response.status,
                message: data?.message,
                backendUrl: `${getApiUrl('v1')}/frontend/dashboard`,
            }));
            return NextResponse.json({ message: data.message || 'Gagal mengambil data dashboard' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: unknown) {
        const cause = error instanceof Error && error.cause instanceof Error
            ? error.cause
            : undefined;
        const session = await sso.session(request).catch(() => null);

        console.error(JSON.stringify({
            event: 'dashboard_sso_fetch_failed',
            errorName: error instanceof Error ? error.name : 'UnknownError',
            errorCode: typeof error === 'object' && error !== null && 'code' in error
                ? String((error as { code?: unknown }).code)
                : undefined,
            errorMessage: error instanceof Error ? error.message : String(error),
            causeName: cause?.name,
            causeMessage: cause?.message,
            hasSession: Boolean(session),
            sessionExpiresAt: session?.expiresAt,
            requestHost: request.headers.get('host'),
        }));

        return NextResponse.json(
            { message: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 401 },
        );
    }
}
