/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:42000/v1';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const isActive = searchParams.get('isActive');

        let url = `${API_URL}/api-keys`;
        const queryParams = new URLSearchParams();
        if (userId) queryParams.append('userId', userId);
        if (isActive) queryParams.append('isActive', isActive);
        if (queryParams.toString()) url += `?${queryParams.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) return NextResponse.json({ message: data.message || 'Failed to fetch API Keys' }, { status: response.status });
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });

        const body = await request.json();
        const response = await fetch(`${API_URL}/api-keys`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) return NextResponse.json({ message: data.message || 'Failed to create API Key' }, { status: response.status });
        return NextResponse.json(data, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
