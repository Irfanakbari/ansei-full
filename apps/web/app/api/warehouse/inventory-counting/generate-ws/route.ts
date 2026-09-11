/*By Irfan Akbari Vuteq Indonesia - 2026-06-11*/
import { NextRequest, NextResponse } from 'next/server';
import { getServerToken } from '@/lib/utils/serverToken';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

export async function POST(request: NextRequest) {
    try {
        const token = await getServerToken(request);
        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const targetUrl = `${API_URL}/inventory-counting/generate-ws`;

        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        // If response is a file (Excel), return as blob
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/vnd.openxmlformats-officedocument') ||
            contentType?.includes('application/vnd.ms-excel') ||
            response.ok) {
            const blob = await response.blob();
            return new NextResponse(blob, {
                status: 200,
                headers: {
                    'Content-Type': contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': response.headers.get('content-disposition') || 'attachment; filename="worksheet.xlsx"',
                },
            });
        }

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal server error' }, { status: 500 });
    }
}