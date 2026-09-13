'use client';

import {useEffect} from 'react';

const APP_VERSION = '1.6.2';

export default function LoginPage() {
    useEffect(() => {
        // Full document navigation — NOT Next.js client (RSC) navigation.
        // The /auth/login route handler responds with a 302 to the external SSO issuer;
        // a client-side router fetch would follow that redirect as a cross-origin fetch
        // and fail the CORS preflight against /oidc/authorize.
        window.location.replace('/auth/login');
    }, []);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
            <p className="text-sm text-slate-300">Redirecting to Vuteq SSO...</p>
            <a
                className="mt-4 rounded bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500"
                href="/auth/login"
            >
                Continue to sign in
            </a>
            <span className="mt-2 text-xs text-slate-500">v{APP_VERSION}</span>
        </main>
    );
}