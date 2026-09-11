/*By Irfan Akbari Vuteq Indonesia - 2026-07-14*/
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/settings/printer-setting/[id] - Get printer setting by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const response = await fetch(`${API_URL}/settings/printer-setting/${id}`, {
            method: 'GET',
            headers: { 'Authorization': authHeader },
            cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Failed to fetch printer setting' },
            { status: 500 }
        );
    }
}

// PATCH /api/settings/printer-setting/[id] - Update printer setting
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const response = await fetch(`${API_URL}/settings/printer-setting/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Failed to update printer setting' },
            { status: 500 }
        );
    }
}

// DELETE /api/settings/printer-setting/[id] - Delete printer setting
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const response = await fetch(`${API_URL}/settings/printer-setting/${id}`, {
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
            { message: error.message || 'Failed to delete printer setting' },
            { status: 500 }
        );
    }
}
