/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import { NextRequest, NextResponse } from 'next/server';
import { getServerToken } from '@/lib/utils/serverToken';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

interface SendDNBody {
    id: string;
    to: string;
    cc?: string;
    subject?: string;
    message?: string;
}

export async function POST(request: NextRequest) {
    try {
        const token = await getServerToken(request);
        if (!token) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body: SendDNBody = await request.json();

        if (!body.id) {
            return NextResponse.json({ message: 'Delivery Note ID is required' }, { status: 400 });
        }

        if (!body.to) {
            return NextResponse.json({ message: 'Recipient email (to) is required' }, { status: 400 });
        }

        // Prepare request body for backend (without id in body, use path instead)
        const { id, ...emailData } = body;

        const response = await fetch(`${API_URL}/transfer-material/${id}/send-dn`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData),
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json(
                { message: data.message || 'Failed to send delivery note' },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
