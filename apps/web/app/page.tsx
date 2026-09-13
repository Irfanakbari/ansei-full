'use client';

import {useVuteqSso} from '@vuteq/sso-client-react/react';
import {useRouter} from 'next/navigation';
import {useEffect} from 'react';

const APP_VERSION = '1.5.3';

export default function LoginPage() {
    const router = useRouter();
    const {authenticated, loading, signIn} = useVuteqSso();

    useEffect(() => {
        if (loading) return;
        if (authenticated) {
            router.replace('/apps');
            return;
        }

        signIn();
    }, [authenticated, loading, router, signIn]);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
            <p className="text-sm text-slate-300">Redirecting to Vuteq SSO...</p>
            <span className="mt-2 text-xs text-slate-500">v{APP_VERSION}</span>
        </main>
    );
}
