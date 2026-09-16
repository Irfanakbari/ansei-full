/* By Irfan Akbari Vuteq Indonesia - 2026-09-16 */
import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';

export async function GET(request: Request) {
    try {
        const response = await fetch(`${getApiUrl('v1', request)}/frontend/man-power`, {
            cache: 'no-store',
        });
        const data: unknown = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { message: 'Failed to fetch manpower list' },
            { status: 500 },
        );
    }
}
