/*By Irfan Akbari Vuteq Indonesia - 2026-06-10*/
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const params = new URLSearchParams();

        // Pagination params
        const page = searchParams.get('page');
        const limit = searchParams.get('limit');
        if (page) params.append('page', page);
        if (limit) params.append('limit', limit);

        // Filter params
        const forecastId = searchParams.get('forecastId');
        const createdBy = searchParams.get('createdBy');

        if (forecastId) params.append('forecastId', forecastId);
        if (createdBy) params.append('createdBy', createdBy);

        const queryString = params.toString();
        const url = `${API_URL}/production/delivery${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal mengambil data delivery' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
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
        const response = await fetch(`${API_URL}/production/delivery`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        // Handle HTTP errors
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal membuat delivery' }, { status: response.status });
        }

        // Handle business logic errors (HTTP 200 but success: false)
        if (data.success === false) {
            return NextResponse.json({ message: data.message || data.error || 'Delivery gagal' }, { status: 400 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}