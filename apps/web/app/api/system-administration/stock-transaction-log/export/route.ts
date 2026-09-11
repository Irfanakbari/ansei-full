/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

interface ExportParams {
    transactionDateFrom?: string;
    transactionDateTo?: string;
    itemCategory?: string;
    transactionType?: string;
    materialId?: string;
    finishGoodId?: string;
    referenceDoc?: string;
    createdBy?: string;
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const params: ExportParams = {};

        // Build query params from request body
        const body = await request.json().catch(() => ({}));

        if (body.transactionDateFrom) params.transactionDateFrom = body.transactionDateFrom;
        if (body.transactionDateTo) params.transactionDateTo = body.transactionDateTo;
        if (body.itemCategory) params.itemCategory = body.itemCategory;
        if (body.transactionType) params.transactionType = body.transactionType;
        if (body.materialId) params.materialId = body.materialId;
        if (body.finishGoodId) params.finishGoodId = body.finishGoodId;
        if (body.referenceDoc) params.referenceDoc = body.referenceDoc;
        if (body.createdBy) params.createdBy = body.createdBy;

        // Build query string
        const queryString = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) queryString.append(key, value);
        });

        const response = await fetch(`${API_URL}/system-log/inventory-ledger/export?${queryString}`, {
            method: 'POST',
            headers: { 'Authorization': authHeader },
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json({ message: data.message || 'Gagal export stock transaction log' }, { status: response.status });
        }

        // Get the file as binary data
        const blob = await response.blob();

        // Extract filename from content-disposition header
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'stock-transaction-log.xlsx';
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
