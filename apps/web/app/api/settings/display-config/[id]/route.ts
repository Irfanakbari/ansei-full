/*By Irfan Akbari Vuteq Indonesia - 2026-07-21*/
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:7500/v1';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/settings/display-config/[id] - Get display config by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const response = await fetch(`${API_URL}/settings/display-config/${id}`, {
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
            { message: error.message || 'Failed to fetch display config' },
            { status: 500 }
        );
    }
}

// PATCH /api/settings/display-config/[id] - Update display config
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        // Convert camelCase to PascalCase for backend
        const payload: Record<string, any> = {};
        if (body.description !== undefined) payload.Description = body.description;
        if (body.url !== undefined) payload.Url = body.url;
        if (body.isOpen !== undefined) payload.IsOpen = body.isOpen;
        if (body.loop !== undefined) payload.Loop = body.loop;

        const response = await fetch(`${API_URL}/settings/display-config/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json(
            { message: error.message || 'Failed to update display config' },
            { status: 500 }
        );
    }
}

// DELETE /api/settings/display-config/[id] - Delete display config
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const { id } = await params;
        const response = await fetch(`${API_URL}/settings/display-config/${id}`, {
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
            { message: error.message || 'Failed to delete display config' },
            { status: 500 }
        );
    }
}
