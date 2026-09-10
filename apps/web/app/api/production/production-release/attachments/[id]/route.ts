/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7500/v1';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// DELETE attachment
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const attachmentId = parseInt(id, 10);

        if (isNaN(attachmentId)) {
            return NextResponse.json({ message: 'Invalid attachment ID' }, { status: 400 });
        }

        const response = await fetch(`${API_URL}/production/production-release/attachments/${attachmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader },
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return NextResponse.json({ message: data.message || 'Gagal hapus lampiran' }, { status: response.status });
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
