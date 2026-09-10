/* By Irfan Akbari Vuteq Indonesia - 2026-07-20 */
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:42000/v1';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });

        const response = await fetch(`${API_URL}/api-keys/${id}/revoke`, {
            method: 'PATCH',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        });

        const data = await response.json();
        if (!response.ok) return NextResponse.json({ message: data.message || 'Failed to revoke API Key' }, { status: response.status });
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
