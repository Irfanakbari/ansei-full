/*By Irfan Akbari Vuteq Indonesia - 2026-06-16*/

'use client';

import React, { Suspense, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import SectigoTrustSeal from '../../../components/SectigoTrustSeal';
import { setAuthData } from '@/store/features/auth/authSlice';
import { AppDispatch } from '@/store';

function SSOCallback() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.push('/?ssoError=true');
      return;
    }

    // Cast session to include accessToken (extended by auth callbacks)
    const extendedSession = session as { accessToken?: string; user?: any };
    const token = extendedSession?.accessToken;
    const user = extendedSession?.user;

    if (!token) {
      router.push('/?ssoError=true');
      return;
    }

    // Delay 3 seconds to give professional feel
    const timer = setTimeout(() => {
      // Update Redux state with token and user data from SSO
      dispatch(setAuthData({
        user: user,
        token: token
      }));

      // Redirect to apps
      router.push('/apps');
    }, 3000);

    return () => clearTimeout(timer);
  }, [session, status, dispatch, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] relative overflow-hidden">
      {/* Background Watermark (Subtle Microsoft Symbol) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] pointer-events-none opacity-[0.02] rotate-12">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-full h-full fill-slate-900">
          <rect x="0" y="0" width="48" height="48" />
          <rect x="52" y="0" width="48" height="48" />
          <rect x="0" y="52" width="48" height="48" />
          <rect x="52" y="52" width="48" height="48" />
        </svg>
      </div>

      <div className="relative z-10 max-w-md w-full p-8 text-center">
        {/* Branding Logo & Text */}
        <div className="mb-10 flex flex-col items-center gap-4">
          <div className="relative w-24 h-12 grayscale opacity-80">
            <Image
              src="/images/vtq.png"
              alt="Vuteq Logo"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-[0.25em]">
            IPCS
          </h1>
        </div>

        {/* Shield Icon */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-100 rounded-full scale-150 blur-xl opacity-50" />
            <div className="relative bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="42"
                height="42"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1e293b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-800"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">
              Secured Login
            </span>
          </div>

          <h2 className="text-xl font-semibold text-slate-800 tracking-tight">
            Authentication Successful
          </h2>
        </div>

        {/* Minimal Progress Bar */}
        <div className="mt-12 max-w-[140px] mx-auto h-[2px] bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-slate-800 rounded-full animate-progress-indefinite" />
        </div>
      </div>

      {/* Sectigo Security Badge - bottom left */}
      <div className="absolute bottom-6 left-10 opacity-70 hover:opacity-100 transition-all duration-500">
        <SectigoTrustSeal />
      </div>

      {/* Footer Microsoft Watermark */}
      <div className="absolute bottom-8 right-10 flex items-center gap-3 opacity-20 grayscale hover:opacity-100 hover:grayscale-0 transition-all duration-500 select-none cursor-default">
        <div className="grid grid-cols-2 gap-[2px]">
          <div className="w-[7px] h-[7px] bg-[#f25022]" />
          <div className="w-[7px] h-[7px] bg-[#7fba00]" />
          <div className="w-[7px] h-[7px] bg-[#00a4ef]" />
          <div className="w-[7px] h-[7px] bg-[#ffb900]" />
        </div>
        <span className="text-[9px] font-bold tracking-[0.25em] text-slate-900 uppercase">
          Microsoft 365
        </span>
      </div>

      <style jsx>{`
        @keyframes progress-indefinite {
          0% { transform: translateX(-100%); width: 30%; }
          50% { transform: translateX(100%); width: 60%; }
          100% { transform: translateX(250%); width: 30%; }
        }
        .animate-progress-indefinite {
          animation: progress-indefinite 2s infinite linear;
        }
      `}</style>
    </div>
  );
}

export default function SSOSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SSOCallback />
    </Suspense>
  );
}