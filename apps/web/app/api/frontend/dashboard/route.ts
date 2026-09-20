/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */

import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';
import { sso } from '@/lib/sso';

export async function GET(request: Request) {
    try {
        const response = await sso.fetch(
            request,
            (() => {
                const backendUrl = new URL(`${getApiUrl('v1')}/frontend/dashboard`);
                const requestUrl = new URL(request.url);
                requestUrl.searchParams.forEach((value, key) => backendUrl.searchParams.set(key, value));
                return backendUrl;
            })(),
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
            causeName: cause?.name,
            hasSession: Boolean(session),
        }));

        return NextResponse.json(
            { message: session ? 'Internal Server Error' : 'Unauthorized' },
            { status: session ? 500 : 401 },
        );
    }
}
