/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';
import { sso } from '@/lib/sso';

export async function GET(request: Request) {
    try {
        const response = await sso.fetch(request, `${getApiUrl('v1', request)}/frontend/notifications`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal mengambil data notifications' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: unknown) {
        return NextResponse.json(
            { message: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 },
        );
    }
}
