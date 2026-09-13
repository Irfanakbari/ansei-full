const APP_VERSION = '1.5.3';

export default function LoginPage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-white">
            <p className="text-sm text-slate-300">Vuteq SSO is required.</p>
            <a
                className="mt-4 rounded bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500"
                href="/auth/login"
            >
                Sign in with Vuteq SSO
            </a>
            <span className="mt-2 text-xs text-slate-500">v{APP_VERSION}</span>
        </main>
    );
}
