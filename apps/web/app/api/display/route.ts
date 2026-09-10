/* By Irfan Akbari Vuteq Indonesia - 2026-08-20 */

import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7500/v1';

export async function GET() {
    try {
        const response = await fetch(`${API_URL}/settings/display-config/active`, {
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
