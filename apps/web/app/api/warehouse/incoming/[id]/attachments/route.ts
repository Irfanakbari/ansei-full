/*By Irfan Akbari Vuteq Indonesia - 2026-07-14*/
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7500/v1';

// GET /api/warehouse/incoming/[id]/attachments - Get attachments for an incoming
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const response = await fetch(`${API_URL}/warehouse/incoming/${id}/attachments`, {
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
            { message: error.message || 'Gagal mengambil lampiran' },
            { status: 500 }
        );
    }
}

// POST /api/warehouse/incoming/[id]/attachments - Upload attachment
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const formData = await request.formData();

        const response = await fetch(`${API_URL}/warehouse/incoming/${id}/attachments`, {
            method: 'POST',
            headers: { 'Authorization': authHeader },
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Gagal upload lampiran' },
            { status: 500 }
        );
    }
}
