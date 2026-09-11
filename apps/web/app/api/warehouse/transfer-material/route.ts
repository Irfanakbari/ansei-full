/*By Irfan Akbari Vuteq Indonesia - 2026-06-11*/
import { NextRequest, NextResponse } from 'next/server';
import { getServerToken } from '@/lib/utils/serverToken';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

export async function GET(request: NextRequest) {
    try {
        const token = await getServerToken(request);
        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const queryString = searchParams.toString();
        const targetUrl = `${API_URL}/transfer-material${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const token = await getServerToken(request);
        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const targetUrl = `${API_URL}/transfer-material`;

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 });
    }
}