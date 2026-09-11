import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:42000/v1';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });

        const body = await request.json();
        const response = await fetch(`${API_URL}/roles/${id}`, {
            method: 'PATCH',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) return NextResponse.json({ message: data.message || 'Failed to update role' }, { status: response.status });
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });

        const response = await fetch(`${API_URL}/roles/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader },
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json({ message: data.message || 'Failed to delete role' }, { status: response.status });
        }
        return NextResponse.json({ message: 'Role deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
