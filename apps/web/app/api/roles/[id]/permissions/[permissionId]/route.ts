import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:42000/v1';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string, permissionId: string }> }) {
    try {
        const { id, permissionId } = await params;
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ message: 'Missing Authorization header' }, { status: 401 });

        const response = await fetch(`${API_URL}/roles/${id}/permissions/${permissionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': authHeader },
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json({ message: data.message || 'Failed to remove permission' }, { status: response.status });
        }
        return NextResponse.json({ message: 'Permission removed successfully' });
    } catch (error: any) {
        return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
