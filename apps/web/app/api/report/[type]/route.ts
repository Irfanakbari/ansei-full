/* By Irfan Akbari Vuteq Indonesia - 2026-07-24 */
import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ type: string }> }
) {
    const { type: reportType } = await params;

    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        // Build the backend path based on report type
        const backendPath: Record<string, { path: string; hasDateFilter: boolean; hasCategoryFilter: boolean; hasLocationFilter: boolean }> = {
            'stock-material': { path: 'report/stock-material', hasDateFilter: false, hasCategoryFilter: false, hasLocationFilter: false },
            'incoming-warehouse': { path: 'report/incoming-warehouse', hasDateFilter: true, hasCategoryFilter: false, hasLocationFilter: false },
            'incoming-rack': { path: 'report/incoming-rack', hasDateFilter: true, hasCategoryFilter: false, hasLocationFilter: false },
            'transfer-material': { path: 'report/transfer-material', hasDateFilter: true, hasCategoryFilter: false, hasLocationFilter: false },
            'production-release': { path: 'report/production-release', hasDateFilter: true, hasCategoryFilter: false, hasLocationFilter: false },
            'pokayoke-scan': { path: 'report/pokayoke-scan', hasDateFilter: true, hasCategoryFilter: false, hasLocationFilter: false },
            'delivery-history': { path: 'report/delivery-history', hasDateFilter: true, hasCategoryFilter: false, hasLocationFilter: false },
            'production-report': { path: 'report/production-report', hasDateFilter: true, hasCategoryFilter: false, hasLocationFilter: false },
            'shopping-history': { path: 'report/shopping-history', hasDateFilter: true, hasCategoryFilter: false, hasLocationFilter: false },
            'material-ng': { path: 'report/material-ng', hasDateFilter: true, hasCategoryFilter: false, hasLocationFilter: false },
            'inventory-ledger': { path: 'report/inventory-ledger', hasDateFilter: true, hasCategoryFilter: true, hasLocationFilter: true },
        };

        const config = backendPath[reportType];

        if (!config) {
            return NextResponse.json({ message: `Report type '${reportType}' not found` }, { status: 404 });
        }

        // Build query params
        const { searchParams } = new URL(request.url);
        const queryString = new URLSearchParams();

        // Add date filters if applicable
        if (config.hasDateFilter) {
            const fromdate = searchParams.get('fromdate');
            const todate = searchParams.get('todate');
            if (fromdate) queryString.append('fromdate', fromdate);
            if (todate) queryString.append('todate', todate);
        }

        // Add category filter if applicable
        if (config.hasCategoryFilter) {
            const category = searchParams.get('category');
            if (category) queryString.append('category', category);
        }

        // Add location filter if applicable
        if (config.hasLocationFilter) {
            const location = searchParams.get('location');
            if (location) queryString.append('location', location);
        }

        const query = queryString.toString() ? `?${queryString.toString()}` : '';
        const fullUrl = `${API_URL}/${config.path}${query}`;

        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
                'Authorization': authHeader,
            },
            credentials: 'include',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json({ message: data.message || 'Failed to generate report' }, { status: response.status });
        }

        // Get the file as binary data
        const blob = await response.blob();

        // Extract filename from content-disposition header
        const contentDisposition = response.headers.get('content-disposition');
        let filename = `${reportType}_report.xlsx`;
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
    } catch (error: unknown) {
        const err = error as Error;
        console.error('Report API error:', err);
        return NextResponse.json({ message: err?.message || 'Internal Server Error' }, { status: 500 });
    }
}
