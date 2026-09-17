/* By Irfan Akbari Vuteq Indonesia - 2026-09-17 */
import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';

export async function GET(request: Request) {
    try {
        const partNumber = new URL(request.url).searchParams.get('partNumber');

        if (!partNumber) {
            return NextResponse.json({ message: 'partNumber is required' }, { status: 400 });
        }

        const query = new URLSearchParams({ partNumber });
        const response = await fetch(
            `${getApiUrl('v1', request)}/frontend/display-target?${query.toString()}`,
            { cache: 'no-store' },
        );
        const data: unknown = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { message: 'Failed to fetch the active production target' },
            { status: 500 },
        );
    }
}
