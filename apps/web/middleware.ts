import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";

export async function middleware(request: NextRequest) {
    const sessionUrl = new URL('/ansei/api/auth/session', request.url);
    const response = await fetch(sessionUrl, {
        headers: {cookie: request.headers.get('cookie') ?? ''},
        cache: 'no-store',
    });
    const session = response.ok ? await response.json() : null;

    if (!session) {
        return NextResponse.redirect(new URL('/ansei/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: "/apps/:path*",
};
