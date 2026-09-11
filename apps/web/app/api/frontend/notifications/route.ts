/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

export async function GET(request: Request) {
    try {
        // Get token from cookie for logging purposes (optional)
        // This endpoint is public and does not require authentication

        const response = await fetch(`${API_URL}/frontend/notifications`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            // Do not forward Authorization header - endpoint is public
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal mengambil data notifications' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
