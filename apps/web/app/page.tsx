"use client";

import Image from "next/image";
import { useEffect } from "react";
import { withBasePath } from "@/lib/base-path";

const APP_VERSION = "6.4.13";

export default function LoginPage() {
  useEffect(() => {
    // Full document navigation — NOT Next.js client (RSC) navigation.
    // The /auth/login route handler responds with a 302 to the external SSO issuer;
    // a client-side router fetch would follow that redirect as a cross-origin fetch
    // and fail the CORS preflight against /oidc/authorize.
    window.location.replace(withBasePath("/auth/login"));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
      <Image
        src={withBasePath("/images/ansei-white.png")}
        alt="ANSEI logo"
        width={180}
        height={90}
        priority
        className="mb-4"
      />
      <p className="text-sm text-slate-300">Redirecting to Vuteq SSO...</p>
      <a
        className="mt-4 rounded bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500"
        href={withBasePath("/auth/login")}
      >
        Continue to sign in
      </a>
      <span className="mt-2 text-xs text-slate-500">v{APP_VERSION}</span>
    </main>
  );
}
