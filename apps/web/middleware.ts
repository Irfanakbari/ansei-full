import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";

export async function middleware(request: NextRequest) {
    // Check if the SSO session cookie exists.
    // The cookie name is 'ansei_sso' (or '__Host-ansei_sso' on HTTPS).
    // This avoids an expensive and potentially failing loopback fetch behind proxies.
    const hasSessionCookie = request.cookies.has('ansei_sso') || request.cookies.has('__Host-ansei_sso');

    if (!hasSessionCookie) {
        // If it's a client-side navigation (RSC fetch), redirecting directly to a Route Handler
        // that returns an external 302 will cause the browser's fetch to follow the redirect
        // and fail with CORS. Redirect to the root page instead, which will do a window.location
        // redirect to the login route on the client side.
        const isRsc =
            request.headers.get('RSC') === '1' ||
            request.headers.get('x-middleware-prefetch') === '1';

        if (isRsc) {
            return NextResponse.redirect(new URL('/ansei', request.url));
        }

        // Redirect directly to login to provide a seamless auto-SSO experience
        return NextResponse.redirect(new URL('/ansei/auth/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: "/apps/:path*",
};
