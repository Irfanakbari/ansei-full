/*By Irfan Akbari Vuteq Indonesia - 2026-06-08*/
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        // Build query parameters
        const params = new URLSearchParams();
        const queryParams = ['page', 'limit', 'transactionDateFrom', 'transactionDateTo', 'itemCategory', 'transactionType', 'materialId', 'finishGoodId', 'referenceDoc', 'createdBy'];

        queryParams.forEach(key => {
            const value = searchParams.get(key);
            if (value) {
                params.append(key, value);
            }
        });

        const queryString = params.toString();
        const url = `${API_URL}/system-log/inventory-ledger${queryString ? `?${queryString}` : ''}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Failed to fetch stock transaction log' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}