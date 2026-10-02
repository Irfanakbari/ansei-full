import { withBasePath } from '@/lib/base-path';

export default function ErrorPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
            <h1 className="text-xl font-bold mb-4 text-red-400">Authentication Error</h1>
            <p className="text-sm text-slate-300 mb-6">There was a problem signing in with Vuteq SSO.</p>
            <a href={withBasePath('/auth/login')} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 text-sm">
                Try Again
            </a>
        </main>
    );
}
