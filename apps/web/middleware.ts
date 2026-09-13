import {NextResponse} from "next/server";
import type {NextRequest} from "next/server";

export async function middleware(request: NextRequest) {
    // Check if the SSO session cookie exists.
    // The cookie name is 'ansei_sso' (or '__Host-ansei_sso' on HTTPS).
    // This avoids an expensive and potentially failing loopback fetch behind proxies.
    const hasSessionCookie = request.cookies.has('ansei_sso') || request.cookies.has('__Host-ansei_sso');

    if (!hasSessionCookie) {
        // Redirect directly to login to provide a seamless auto-SSO experience
        return NextResponse.redirect(new URL('/ansei/auth/login', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: "/apps/:path*",
};
