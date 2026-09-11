/*By Irfan Akbari Vuteq Indonesia - 2026-06-07*/
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

interface RouteParams {
    params: Promise<{ uid: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { uid } = await params;
        const response = await fetch(`${API_URL}/master/man-power/${uid}`, {
            method: 'GET',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal mengambil data man power' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { uid } = await params;
        const body = await request.json();
        const response = await fetch(`${API_URL}/master/man-power/${uid}`, {
            method: 'PATCH',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal update man power' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { uid } = await params;
        const response = await fetch(`${API_URL}/master/man-power/${uid}`, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal hapus man power' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
