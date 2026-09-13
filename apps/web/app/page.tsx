'use client';

import {useEffect} from 'react';

const APP_VERSION = '1.5.3';

export default function LoginPage() {
    useEffect(() => {
        // Keep the browser navigation flow identical to the SSO server example.
        // A fetch/XHR to the external authorize endpoint triggers a CORS preflight;
        // the login route must be reached through a full document navigation.
        window.location.replace('/auth/login');
    }, []);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
            <p className="text-sm text-slate-300">Redirecting to Vuteq SSO...</p>
            <span className="mt-2 text-xs text-slate-500">v{APP_VERSION}</span>
        </main>
    );
}
