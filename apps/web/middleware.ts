import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only protect /apps/* routes
    // if (pathname.startsWith('/apps')) {
    //     const session = await getToken({
    //         req: request,
    //         secret: process.env.NEXTAUTH_SECRET
    //     });
    //     const token = request.cookies.get('token');

    //     if (!session && !token) {
    //         return NextResponse.redirect(new URL('/', request.url));
    //     }
    // }

    return NextResponse.next();
}

export const config = {
    matcher: "/apps/:path*",
};
