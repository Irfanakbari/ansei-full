'use client';

/* By Irfan Akbari Vuteq Indonesia - 2026-06-18 - Original Theme with Font Improvements */

import React, { Suspense, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppDispatch } from '@/store';
import { loginUser } from '@/store/features/auth/authSlice';
import { selectAuthLoading, selectAuthError, selectIsAuthenticated } from '@/store/features/auth/authSelectors';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { signIn } from 'next-auth/react';
import SectigoTrustSeal from '../components/SectigoTrustSeal';

function LoginForm() {
    const dispatch = useDispatch<AppDispatch>();
    const router = useRouter();
    const loading = useSelector(selectAuthLoading);
    const error = useSelector(selectAuthError);
    const isAuthenticated = useSelector(selectIsAuthenticated);

    const searchParams = useSearchParams();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [sessionExpired, setSessionExpired] = useState(false);
    const [ssoError, setSsoError] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            router.push('/apps');
        }
    }, [isAuthenticated, router]);

    useEffect(() => {
        sessionStorage.removeItem('processing401');

        if (searchParams.get('sessionExpired') === 'true') {
            setSessionExpired(true);
            window.history.replaceState({}, '', '/');
        }
        if (searchParams.get('ssoError') === 'true') {
            setSsoError(true);
            window.history.replaceState({}, '', '/');
        }
    }, [searchParams]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username && password) {
            dispatch(loginUser({ username, password }));
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            {/* Background Image */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center"
                style={{ backgroundImage: `url(/images/main-bg.png)` }}
            />

            {/* Overlay */}
            <div className="absolute inset-0 z-0 bg-blue-900/30 backdrop-blur-[1px]" />

            {/* Glassmorphism Card */}
            <div className="relative z-10 w-[95%] sm:w-[80%] md:w-[50%] lg:w-[35%] xl:w-[30%] p-6 sm:p-8 rounded-xl border border-white/20 shadow-2xl backdrop-blur-sm bg-white/10">

                {/* Logo / Title area */}
                <div className="text-center mb-8">
                    <h2 className="text-xl font-bold text-white tracking-wider mb-3">
                        IPCS-26 ANSEI
                    </h2>
                    <h2 className="text-base font-medium text-transparent bg-clip-text bg-linear-to-r from-blue-300 via-purple-300 to-pink-300 tracking-wider drop-shadow-lg">
                        Icuk Production Control System
                    </h2>
                </div>

                {/* Session Expired Alert */}
                {sessionExpired && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-100 text-sm backdrop-blur-sm flex items-center justify-between">
                        <span>⚠️ Your session has expired. Please login again.</span>
                        <button
                            onClick={() => setSessionExpired(false)}
                            className="ml-2 text-amber-200 hover:text-white transition-colors leading-none"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* SSO Error Alert */}
                {ssoError && (
                    <div className="mb-4 p-3 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-100 text-sm backdrop-blur-sm flex items-center justify-between">
                        <span>⚠️ Your account is not registered with SSO. Please login manually.</span>
                        <button
                            onClick={() => setSsoError(false)}
                            className="ml-2 text-amber-200 hover:text-white transition-colors leading-none"
                        >
                            x
                        </button>
                    </div>
                )}

                {/* Error Alert */}
                {error && (
                    <div className="mb-6 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-100 text-sm text-center backdrop-blur-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Username Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-blue-100 uppercase tracking-wide ml-1">
                            Username
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-200 group-focus-within:text-white transition-colors">
                                <UserOutlined />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 rounded-lg bg-black/20 border border-white/10 text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:bg-black/30 transition-all duration-200 shadow-inner backdrop-blur-sm"
                                placeholder="Enter your username"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-xs font-medium text-blue-100 uppercase tracking-wide">
                                Password
                            </label>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-200 group-focus-within:text-white transition-colors">
                                <LockOutlined />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 rounded-lg bg-black/20 border border-white/10 text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:bg-black/30 transition-all duration-200 shadow-inner backdrop-blur-sm"
                                placeholder="Enter your password"
                                required
                            />
                        </div>
                    </div>

                    {/* Login Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 px-4 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-white font-medium shadow-lg backdrop-blur-sm border border-blue-500/30 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                    >
                        {loading ? (
                            <svg className="animate-spin h-5 w-5 mr-2 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        ) : 'Login'}
                    </button>
                </form>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                    </div>
                </div>

                {/* Microsoft SSO Button - DISABLED
                <button
                    type="button"
                    onClick={() => signIn('azure-ad', { callbackUrl: '/auth/sso-success' })}
                    className="w-full py-3 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium shadow-lg backdrop-blur-sm border border-white/10 transition-all duration-200 transform hover:scale-[1.02] flex justify-center items-center gap-3 group"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 21 21" className="group-hover:scale-110 transition-transform duration-200">
                        <rect x="0" y="0" width="10" height="10" fill="#f25022" />
                        <rect x="11" y="0" width="10" height="10" fill="#7fba00" />
                        <rect x="0" y="11" width="10" height="10" fill="#00a4ef" />
                        <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
                    </svg>
                    <span className="tracking-wide">Login with Microsoft 365</span>
                </button>
                */}
            </div>

            {/* Footer */}
            <div className="absolute bottom-6 w-full text-center z-10 px-4 flex flex-col items-center gap-3">
                {/*<SectigoTrustSeal />*/}
                <p className="text-xs text-white/60 drop-shadow-md">
                    Copyright © 2026 Vuteq Indonesia Digital Information System
                    <br />
                    Version 1.3.0
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    );
}
