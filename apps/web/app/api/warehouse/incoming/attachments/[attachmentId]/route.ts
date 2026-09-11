/*By Irfan Akbari Vuteq Indonesia - 2026-07-14*/
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

// DELETE /api/warehouse/incoming/attachments/[attachmentId] - Delete an attachment
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ attachmentId: string }> }
) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { attachmentId } = await params;
        const response = await fetch(`${API_URL}/warehouse/incoming/attachments/${attachmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader },
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Gagal hapus lampiran' },
            { status: 500 }
        );
    }
}
