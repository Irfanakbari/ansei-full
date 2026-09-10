/*By Irfan Akbari Vuteq Indonesia - 2026-07-21*/
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7500/v1';

export interface DisplayConfigEntity {
    Id: number;
    Description: string;
    Url: string;
    IsOpen: boolean;
    Loop: boolean;
    CreatedAt: string;
    UpdatedAt: string;
}

export interface CreateDisplayConfigDto {
    description: string;
    url: string;
    isOpen: boolean;
    loop: boolean;
}

export interface UpdateDisplayConfigDto {
    description?: string;
    url?: string;
    isOpen?: boolean;
    loop?: boolean;
}

// GET /api/settings/display-config - Get all display configs
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const response = await fetch(`${API_URL}/settings/display-config`, {
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
            { message: error.message || 'Failed to fetch display configs' },
            { status: 500 }
        );
    }
}

// POST /api/settings/display-config - Create display config
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });
        }

        const body = await request.json();
        // Convert camelCase to PascalCase for backend
        const payload = {
            Description: body.description,
            Url: body.url,
            IsOpen: body.isOpen,
            Loop: body.loop,
        };

        const response = await fetch(`${API_URL}/settings/display-config`, {
            method: 'POST',
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
            { message: error.message || 'Failed to create display config' },
            { status: 500 }
        );
    }
}
