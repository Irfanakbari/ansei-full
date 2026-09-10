/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7500/v1';

export async function POST(request: Request) {
    try {
        const response = await fetch(`${API_URL}/mrp/export`, {
            method: 'POST',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json({ message: data.message || 'Gagal export MRP' }, { status: response.status });
        }

        // Get the file as binary data
        const blob = await response.blob();

        // Extract filename from content-disposition header
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'mrp-export.xlsx';
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?(.+)"?/);
            if (match) {
                filename = match[1];
            }
        }

        // Return the file
        return new NextResponse(blob, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': blob.size.toString(),
            },
        });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
