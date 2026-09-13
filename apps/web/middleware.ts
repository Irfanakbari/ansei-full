import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";

export async function middleware(request: NextRequest) {
    const isRsc =
        request.headers.get('RSC') === '1' ||
        request.headers.get('x-middleware-prefetch') === '1' ||
        request.nextUrl.searchParams.has('_rsc');

    // Never allow Next.js client router to fetch /auth/login as an RSC request.
    // That route returns a 302 to an external SSO provider, which causes browser fetch()
    // to follow the redirect and fail with a CORS preflight error.
    if (request.nextUrl.pathname.endsWith('/auth/login') && isRsc) {
        return NextResponse.redirect(new URL('/ansei', request.url));
    }

    // Check if the SSO session cookie exists.
    // The cookie name is 'ansei_sso' (or '__Host-ansei_sso' on HTTPS).
    // This avoids an expensive and potentially failing loopback fetch behind proxies.
    const hasSessionCookie = request.cookies.has('ansei_sso') || request.cookies.has('__Host-ansei_sso');

    if (!hasSessionCookie) {
        if (isRsc) {
            return NextResponse.redirect(new URL('/ansei', request.url));
        }

        // Redirect directly to login to provide a seamless auto-SSO experience
        return NextResponse.redirect(new URL('/ansei/auth/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/apps/:path*", "/auth/login", "/auth/callback"],
};
