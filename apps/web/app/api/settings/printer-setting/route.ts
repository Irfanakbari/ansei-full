/*By Irfan Akbari Vuteq Indonesia - 2026-07-14*/
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7500/v1';

// GET /api/settings/printer-setting - Get all printer settings
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const response = await fetch(`${API_URL}/settings/printer-setting`, {
            method: 'GET',
            headers: { 'Authorization': authHeader },
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Failed to fetch printer settings' },
            { status: 500 }
        );
    }
}

// POST /api/settings/printer-setting - Create printer setting
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const body = await request.json();
        const response = await fetch(`${API_URL}/settings/printer-setting`, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Failed to create printer setting' },
            { status: 500 }
        );
    }
}
