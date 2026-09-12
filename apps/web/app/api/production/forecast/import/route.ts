/*By Irfan Akbari Vuteq Indonesia - 2026-06-08*/
import {NextResponse} from 'next/server';
import {getApiUrl} from '@/lib/config';
import {sso} from '@/lib/sso';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const response = await sso.fetch(request, `${getApiUrl()}/production/forecast/import`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json({message: data.message || 'Gagal import forecast'}, {status: response.status});
        }
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({message: error.message || 'Internal Server Error'}, {status: 500});
    }
}