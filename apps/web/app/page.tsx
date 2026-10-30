"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useVuteqSso } from "@vuteq/sso-client-react/react";
import { withBasePath } from "@/lib/base-path";

const APP_VERSION = "6.36.2";

export default function LoginPage() {
  const router = useRouter();
  const { session, loading } = useVuteqSso();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      // Full document navigation — NOT Next.js client (RSC) navigation.
      // The /auth/login route handler responds with a 302 to the external SSO issuer;
      // a client-side router fetch would follow that redirect as a cross-origin fetch
      // and fail the CORS preflight against /oidc/authorize.
      window.location.replace(withBasePath("/auth/login"));
      return;
    }

    const profile = session.attributes as
      { AccessStatus?: string; RoleName?: string } | undefined;
    const isGlobalSuper = session.globalRoles?.includes("SUPER_ADMINISTRATOR");
    const isGlobalRoAdmin = session.globalRoles?.includes("RO_ADMINISTRATOR");
    const hasRole = Boolean(session.roles?.[0] || profile?.RoleName);
    const isPending =
      profile?.AccessStatus === "PENDING"
        ? !isGlobalSuper && !isGlobalRoAdmin
        : !hasRole && !isGlobalSuper && !isGlobalRoAdmin;

    if (isPending) {
      router.replace("/auth/pending-account");
    } else if (
      profile?.AccessStatus === "ACTIVE" ||
      hasRole ||
      isGlobalSuper ||
      isGlobalRoAdmin
    ) {
      router.replace("/apps");
    } else {
      router.replace("/auth/error");
    }
  }, [loading, router, session]);

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
