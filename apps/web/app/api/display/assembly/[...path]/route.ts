/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
import { NextResponse } from 'next/server';
import { getApiUrl } from '@/lib/config';
type Context = { params: Promise<{ path: string[] }> };
async function proxy(request: Request, context: Context) {
    const { path } = await context.params;
    const isGet = request.method === 'GET';
    const allowed = isGet
        ? (path.length === 1 && path[0] === 'operator') ||
          (path.length === 2 && path[0] === 'labels')
        : (path.length === 1 && path[0] === 'start') ||
          (path.length === 2 &&
              path[1] === 'complete' &&
              /^[0-9a-f-]{36}$/i.test(path[0]));
    if (!allowed)
        return NextResponse.json({ message: 'Not found' }, { status: 404 });
    try {
        const search = new URL(request.url).search;
        const response = await fetch(
            `${getApiUrl('v1', request)}/display/assembly/${path.map(encodeURIComponent).join('/')}${search}`,
            {
                method: request.method,
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: isGet ? undefined : JSON.stringify(await request.json()),
                signal: AbortSignal.timeout(25000),
            }
        );
        return NextResponse.json(await response.json(), {
            status: response.status,
        });
    } catch {
        return NextResponse.json(
            {
                message:
                    'Cannot reach assembly service. Refresh session before retrying.',
            },
            { status: 502 }
        );
    }
}
export const GET = proxy;
export const POST = proxy;
