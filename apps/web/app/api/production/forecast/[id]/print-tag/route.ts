/* By Irfan Akbari Vuteq Indonesia - 2026-08-20 */

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const response = await fetch(`${API_URL}/production/forecast/${id}/print-tag`, {
            method: 'POST',
            headers: { 'Authorization': authHeader },
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Failed to print tag' },
            { status: 500 }
        );
    }
}
