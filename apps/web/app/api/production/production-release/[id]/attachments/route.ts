/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7500/v1';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET attachments
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const response = await fetch(`${API_URL}/production/production-release/${id}/attachments`, {
            method: 'GET',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal mengambil data lampiran' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

// POST upload attachment
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;

        // Get form data from request
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const productionReleaseId = formData.get('productionReleaseId') as string | null;
        const forecastId = formData.get('forecastId') as string | null;

        if (!file) {
            return NextResponse.json({ message: 'File is required' }, { status: 400 });
        }

        // Create new FormData for backend
        const backendFormData = new FormData();
        backendFormData.append('file', file);
        if (productionReleaseId) {
            backendFormData.append('productionReleaseId', productionReleaseId);
        }
        if (forecastId) {
            backendFormData.append('forecastId', forecastId);
        }

        const response = await fetch(`${API_URL}/production/production-release/${id}/attachments`, {
            method: 'POST',
            headers: { 'Authorization': authHeader },
            body: backendFormData,
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal upload lampiran' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
