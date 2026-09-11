import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:42000/v1';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');

        if (!authHeader) {
            return NextResponse.json(
                { message: 'Missing Authorization header' },
                { status: 401 }
            );
        }

        const url = new URL(request.url);
        const searchParams = url.search;

        const fetchUrl = `${API_URL}/system-log${searchParams}`;

        const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
        });

        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return new Response(null, { status: response.status });
        }

        const textData = await response.text();
        let data;
        try {
            data = textData ? JSON.parse(textData) : {};
        } catch (e) {
            data = textData;
        }

        if (!response.ok) {
            return NextResponse.json(
                { message: data?.message || (typeof data === 'string' ? data : 'Backend request failed') },
                { status: response.status }
            );
        }

        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
