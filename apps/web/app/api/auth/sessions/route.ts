import { NextResponse } from 'next/server';
/*By Irfan Akbari Vuteq Indonesia - 21 May 2026*/

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://10.10.10.10:7500';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json(
                { message: 'Missing Authorization header' },
                { status: 401 }
            );
        }

        const response = await fetch(`${API_URL}/auth/sessions`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(
                { message: data.message || 'Gagal mengambil data sesi' },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}