/* By Irfan Akbari Vuteq Indonesia - 2026-09-16 */
import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const response = await fetch(`${getApiUrl('v1', request)}/production/production-report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data: unknown = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data, { status: 201 });
    } catch {
        return NextResponse.json(
            { message: 'Gagal mengirim laporan produksi ke server' },
            { status: 500 },
        );
    }
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const nik = url.searchParams.get('nik');
        const date = url.searchParams.get('date');
        const limit = url.searchParams.get('limit') || '20';

        if (!nik) {
            return NextResponse.json(
                { message: 'NIK operator wajib disertakan' },
                { status: 400 },
            );
        }

        const queryParams = new URLSearchParams();
        if (date) queryParams.set('date', date);
        if (limit) queryParams.set('limit', limit);

        const backendUrl = `${getApiUrl('v1', request)}/production/production-report/operator-history/${encodeURIComponent(nik)}?${queryParams.toString()}`;

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
            { message: 'Gagal mengambil riwayat laporan produksi operator' },
            { status: 500 },
        );
    }
}
