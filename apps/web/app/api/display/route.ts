/* By Irfan Akbari Vuteq Indonesia - 2026-08-20 */

import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';

export async function GET(request: Request) {
    try {
        const line = new URL(request.url).searchParams.get('line');
        const query = line ? `?line=${encodeURIComponent(line)}` : '';
        const response = await fetch(`${getApiUrl('v1', request)}/settings/display-config/active${query}`, {
            cache: 'no-store',
        });
        const data: unknown = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch {
        return NextResponse.json(
            { message: 'Failed to fetch active display configuration' },
            { status: 500 },
        );
    }
}
