/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/

import type { NextAuthOptions } from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    accessToken?: string;
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      [key: string]: unknown;
    };
  }

  /**
   * NextAuth API handler type
   */
  type NextAuthHandler = (req: Request, context?: { params?: Record<string, string> }) => Promise<Response>;
}

declare function NextAuth(options: NextAuthOptions): import("next-auth").NextAuthHandler;

export { NextAuth };

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    accessToken?: string;
    user?: {
      id: string;
      [key: string]: unknown;
    };
  }
}
