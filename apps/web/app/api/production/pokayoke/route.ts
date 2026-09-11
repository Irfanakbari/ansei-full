/*By Irfan Akbari Vuteq Indonesia - 2026-06-09*/
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        // Log request URL for debugging
        console.log('[POKAYOKE GET] Request URL:', request.url);

        const response = await fetch(`${API_URL}/production/pokayoke`, {
            method: 'GET',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        const data = await response.json();
        console.log('[POKAYOKE GET] Response:', data);

        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal mengambil data pokayoke' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[POKAYOKE GET] Error:', error);
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const body = await request.json();
        const response = await fetch(`${API_URL}/production/pokayoke/scan`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal scan pokayoke' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
