/*By Irfan Akbari Vuteq Indonesia - 2026-06-11*/
import {NextRequest, NextResponse} from 'next/server';
import {getApiUrl} from '@/lib/config';
import {sso} from '@/lib/sso';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, {params}: RouteParams) {
    try {
        const {id} = await params;
        const targetUrl = `${getApiUrl()}/transfer-material/${encodeURIComponent(id)}/generate-dn`;

        const response = await sso.fetch(request, targetUrl, {
            method: 'POST',
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = 'Failed to generate Delivery Note PDF';
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch {
                if (errorText) errorMessage = errorText;
            }
            return NextResponse.json({message: errorMessage}, {status: response.status});
        }

        // Return as PDF blob
        const blob = await response.blob();
        return new NextResponse(blob, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="DN-${id}.pdf"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json({message: error.message || 'Internal server error'}, {status: 500});
    }
}
