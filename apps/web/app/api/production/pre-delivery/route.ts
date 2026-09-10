/*By Irfan Akbari Vuteq Indonesia - 2026-06-09*/
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7500/v1';

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
        const productionReleaseId = searchParams.get('productionReleaseId');
        const forecastId = searchParams.get('forecastId');
        const finishGoodId = searchParams.get('finishGoodId');
        const labelNumber = searchParams.get('labelNumber');
        const scanned = searchParams.get('scanned');

        if (productionReleaseId) params.append('productionReleaseId', productionReleaseId);
        if (forecastId) params.append('forecastId', forecastId);
        if (finishGoodId) params.append('finishGoodId', finishGoodId);
        if (labelNumber) params.append('labelNumber', labelNumber);
        if (scanned) params.append('scanned', scanned);

        const queryString = params.toString();
        const url = `${API_URL}/production/pre-delivery${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal mengambil data pre delivery goods' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
