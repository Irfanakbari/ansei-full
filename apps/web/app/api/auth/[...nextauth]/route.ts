/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/

import NextAuth, { type DefaultSession } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { cookies, headers } from "next/headers";
import { createTokenCookie } from "../_lib/cookie";

// Extend the default session type
type ExtendedSession = DefaultSession["user"] & {
    accessToken?: string;
    user?: {
        id: string;
        [key: string]: unknown;
    };
};

// Type for NextAuth configuration
const options = {
    secret: process.env.NEXTAUTH_SECRET,
    session: {
        strategy: "jwt" as const,
    },
    providers: [
        AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            tenantId: process.env.AZURE_AD_TENANT_ID!,
        }),
    ],
    callbacks: {
        async jwt({ token, user, account }: { token: ExtendedSession; user?: ExtendedSession; account?: Record<string, unknown> | null }) {
            // Persist the internal JWT to the token right after signin
            if (account && account.provider === 'azure-ad') {
                try {
                    // Execute the token exchange with backend API (NEXT_PUBLIC_CALLBACK_AUTH_URL)
                    const backendUrl = process.env.NEXT_PUBLIC_CALLBACK_AUTH_URL;

                    if (!backendUrl) {
                        console.error('NEXT_PUBLIC_CALLBACK_AUTH_URL is not defined in the environment.');
                        return token;
                    }

                    const reqHeaders = await headers();
                    const realIp = reqHeaders.get('x-real-ip') || reqHeaders.get('x-forwarded-for')?.split(',')[0].trim() || 'Unknown';
                    const userAgent = reqHeaders.get('user-agent') || 'Unknown';
                    const res = await fetch(backendUrl, {
                        method: 'POST',
                        body: JSON.stringify({
                            token: account.access_token,
                        }),
                        headers: {
                            "Content-Type": "application/json",
                            "x-real-ip": realIp,
                            "x-user-agent": userAgent,
                        }
                    });

                    const userData = await res.json();

                    if (res.ok && userData) {
                        token.accessToken = userData.AccessToken;
                        token.user = userData.User;

                        const cookieStore = await cookies();
                        cookieStore.set(createTokenCookie(userData.AccessToken));
                    } else {
                        console.error("Token exchange failed:", userData);
                    }
                } catch (error) {
                    console.error("Token exchange err:", error);
                }
            } else if (user) {
                // For credentials provider, user object is returned from authorize()
                token.accessToken = user.accessToken as string;
                token.user = user.user as { id: string };
            }
            return token;
        },
        async session({ session, token }: { session: DefaultSession; token: Record<string, unknown> }) {
            // Send properties to the client
            (session as unknown as { accessToken?: string; user?: unknown }).accessToken = token.accessToken as string;
            (session as unknown as { user?: unknown }).user = token.user as unknown;
            return session;
        }
    },
    pages: {
        signIn: '/', // Using the root page as the signin page
        error: '/',  // Redirect back to root on SSO errors
    }
};

 
const handler = NextAuth(options);

// Export named methods for Next.js 16
export { handler as GET, handler as POST };