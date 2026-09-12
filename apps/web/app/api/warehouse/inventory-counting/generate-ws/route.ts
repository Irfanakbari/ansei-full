/*By Irfan Akbari Vuteq Indonesia - 2026-06-11*/
import {NextRequest, NextResponse} from 'next/server';
import {getApiUrl} from '@/lib/config';
import {sso} from '@/lib/sso';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const targetUrl = `${getApiUrl()}/inventory-counting/generate-ws`;

        const response = await sso.fetch(request, targetUrl, {
            method: 'POST',
            headers: {
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
        return NextResponse.json(data, {status: response.status});
    } catch (error: any) {
        return NextResponse.json({message: error.message || 'Internal server error'}, {status: 500});
    }
}