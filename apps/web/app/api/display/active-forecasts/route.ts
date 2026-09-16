/* By Irfan Akbari Vuteq Indonesia - 2026-09-16 */
import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const finishGoodId = url.searchParams.get('finishGoodId');

        const queryParams = new URLSearchParams();
        if (finishGoodId) queryParams.set('finishGoodId', finishGoodId);

        const backendUrl = `${getApiUrl('v1', request)}/production/production-report/active-forecasts?${queryParams.toString()}`;

        const response = await fetch(backendUrl, {
            cache: 'no-store',
        });

        const data: unknown = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { message: 'Gagal mengambil daftar forecast aktif' },
            { status: 500 },
        );
    }
}
