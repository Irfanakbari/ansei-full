/* By Irfan Akbari Vuteq Indonesia - 2026-08-20 */
'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FullscreenExitOutlined, FullscreenOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { fetchActiveDisplayConfig } from '@/store/features/display/displaySlice';

export default function DisplayPage() {
    const dispatch = useDispatch<AppDispatch>();
    const displayRef = useRef<HTMLElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { config } = useSelector((state: RootState) => state.display);

    useEffect(() => {
        void dispatch(fetchActiveDisplayConfig());
    }, [dispatch]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === displayRef.current);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    const toggleFullscreen = useCallback(async () => {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
            return;
        }

        await displayRef.current?.requestFullscreen();
    }, []);

    return (
        <main ref={displayRef} className="fixed inset-0 flex flex-col overflow-hidden bg-black">
            <header className="flex h-16 shrink-0 items-center justify-between bg-white px-6 shadow-md">
                <Image
                    src="/images/vtq.png"
                    alt="Vuteq Indonesia"
                    width={120}
                    height={40}
                    priority
                    className="h-10 w-auto object-contain"
                />
                <button
                    type="button"
                    onClick={() => void toggleFullscreen()}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-xl text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                    {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                </button>
            </header>
            <section className="min-h-0 flex-1">
                {config && (
                    <video
                        key={config.Id}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                    >
                        <source src={config.Url} />
                    </video>
                )}
            </section>
        </main>
    );
}
