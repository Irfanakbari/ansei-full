/* By Irfan Akbari Vuteq Indonesia - 2026-08-20 - Updated 2026-09-16 */
'use client';

import Image from 'next/image';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
    FullscreenExitOutlined,
    FullscreenOutlined,
    SettingOutlined,
    UserOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    FormOutlined,
    HistoryOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import {Button, Modal, Form, Select, App, Spin, Tag, Avatar, ConfigProvider} from 'antd';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/store';
import {
    clearDisplayTarget,
    fetchActiveDisplayConfig,
    fetchDisplayTarget,
} from '@/store/features/display/displaySlice';
import AssemblyScanPanel from './_components/AssemblyScanPanel';
import OperatorReportModal from './_components/OperatorReportModal';
import ProductionFindingModal from './_components/ProductionFindingModal';
import {withBasePath} from '@/lib/base-path';

export interface DisplayManPower {
    Nik: string;
    Name: string;
    PicturePath: string | null;
    Line: string | null;
    SkillMatrix?: { Id: number; Label: string; Point: number }[];
}

export interface DisplayFinishGood {
    PartNumber: string;
    PartName: string;
    Alias: string | null;
}

export interface DisplayStationConfig {
    selectedNik?: string | null;
    selectedPartNumber?: string | null;
    manpower: DisplayManPower | null;
    finishGood: DisplayFinishGood | null;
}

const STORAGE_KEY = 'display_config';
const FALLBACK_MEDIA_URL = 'http://192.168.1.15:8080/Ansei_Asset/fallback.png';

function SkillQuadrantCircle({level, size = 48}: { level: number; size?: number }) {
    const fillColor = '#2563eb';
    const emptyColor = '#f8fafc';

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 32 32"
            className="shrink-0 drop-shadow-xs"
            aria-label={`Skill level ${level} of 4`}
        >
            <circle cx="16" cy="16" r="14" fill="#ffffff"/>
            <path
                d="M 16 16 L 16 2 A 14 14 0 0 1 30 16 Z"
                fill={level >= 1 ? fillColor : emptyColor}
            />
            <path
                d="M 16 16 L 30 16 A 14 14 0 0 1 16 30 Z"
                fill={level >= 2 ? fillColor : emptyColor}
            />
            <path
                d="M 16 16 L 16 30 A 14 14 0 0 1 2 16 Z"
                fill={level >= 3 ? fillColor : emptyColor}
            />
            <path
                d="M 16 16 L 2 16 A 14 14 0 0 1 16 2 Z"
                fill={level >= 4 ? fillColor : emptyColor}
            />
            <line x1="16" y1="2" x2="16" y2="30" stroke="#94a3b8" strokeWidth="1.5"/>
            <line x1="2" y1="16" x2="30" y2="16" stroke="#94a3b8" strokeWidth="1.5"/>
            <circle
                cx="16"
                cy="16"
                r="14"
                fill="none"
                stroke="#64748b"
                strokeWidth="1.8"
            />
        </svg>
    );
}

interface DisplayPageContentProps {
    isFullscreen: boolean;
    getOverlayContainer: () => HTMLElement;
    toggleFullscreen: () => Promise<void>;
}

function DisplayPageContent({
                                isFullscreen,
                                getOverlayContainer,
                                toggleFullscreen,
                            }: DisplayPageContentProps) {
    const {message} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const videoRef = useRef<HTMLVideoElement>(null);
    const {config, target, targetLoading, targetError} = useSelector(
        (state: RootState) => state.display,
    );
    const mediaSource = config?.FilePath || config?.Url || FALLBACK_MEDIA_URL;
    const isImageMedia = mediaSource ? /\.(png|jpe?g|gif|webp)(?:\?.*)?$/i.test(mediaSource) : false;

    // Saved configuration (loaded initially from localStorage, then refreshed from API)
    const [stationConfig, setStationConfig] = useState<DisplayStationConfig>({
        selectedNik: null,
        selectedPartNumber: null,
        manpower: null,
        finishGood: null,
    });

    // Modal and options state
    const [assemblyLocked, setAssemblyLocked] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isFindingOpen, setIsFindingOpen] = useState(false);
    const [reportInitialTab, setReportInitialTab] = useState<'form' | 'history'>('form');
    const [manPowerList, setManPowerList] = useState<DisplayManPower[]>([]);
    const [finishGoodsList, setFinishGoodsList] = useState<DisplayFinishGood[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);

    // Live clock for Production Date & Time
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

    useEffect(() => {
        if (mediaSource && !isImageMedia && videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(e => console.warn('Autoplay blocked:', e));
        }
    }, [mediaSource, isImageMedia]);

    useEffect(() => {
        setCurrentTime(new Date());
        const clockInterval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(clockInterval);
    }, []);

    // Form inside modal
    const [form] = Form.useForm();

    // Fetch fresh options & update active station details from API
    const refreshDataFromApi = useCallback(
        async (targetNikOverride?: string | null, targetPartNumberOverride?: string | null) => {
            try {
                const [mpRes, fgRes] = await Promise.all([
                    fetch(withBasePath('/api/display/manpower'), {cache: 'no-store'}),
                    fetch(withBasePath('/api/display/finish-goods'), {cache: 'no-store'}),
                ]);

                let updatedMpList: DisplayManPower[] = [];
                let updatedFgList: DisplayFinishGood[] = [];

                if (mpRes.ok) {
                    const mpJson = await mpRes.json();
                    updatedMpList = Array.isArray(mpJson?.data)
                        ? mpJson.data
                        : Array.isArray(mpJson)
                            ? mpJson
                            : [];
                    setManPowerList(updatedMpList);
                }

                if (fgRes.ok) {
                    const fgJson = await fgRes.json();
                    updatedFgList = Array.isArray(fgJson?.data)
                        ? fgJson.data
                        : Array.isArray(fgJson)
                            ? fgJson
                            : [];
                    setFinishGoodsList(updatedFgList);
                }

                // Sync stationConfig with fresh API data
                setStationConfig((prev) => {
                    const targetNik =
                        targetNikOverride !== undefined
                            ? targetNikOverride
                            : (prev.selectedNik ?? prev.manpower?.Nik ?? null);
                    const targetPartNumber =
                        targetPartNumberOverride !== undefined
                            ? targetPartNumberOverride
                            : (prev.selectedPartNumber ?? prev.finishGood?.PartNumber ?? null);

                    const freshMp = targetNik
                        ? (updatedMpList.find((m) => m.Nik === targetNik) ?? prev.manpower)
                        : prev.manpower;

                    const freshFg = targetPartNumber
                        ? (updatedFgList.find((f) => f.PartNumber === targetPartNumber) ?? prev.finishGood)
                        : prev.finishGood;

                    const newConfig: DisplayStationConfig = {
                        selectedNik: targetNik,
                        selectedPartNumber: targetPartNumber,
                        manpower: freshMp,
                        finishGood: freshFg,
                    };

                    // Persist updated fresh data back to localStorage
                    try {
                        if (newConfig.selectedNik || newConfig.selectedPartNumber) {
                            localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
                        }
                    } catch (e) {
                        console.error('Failed to sync updated display config to localStorage', e);
                    }

                    return newConfig;
                });
            } catch (err) {
                console.error('Failed to load fresh display data from API', err);
            }
        },
        [],
    );

    // Load initial cached configuration from localStorage on mount AND immediately fetch fresh API data
    useEffect(() => {
        let savedNik: string | null = null;
        let savedPartNumber: string | null = null;

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Partial<DisplayStationConfig>;
                if (parsed && typeof parsed === 'object') {
                    savedNik = parsed.selectedNik ?? parsed.manpower?.Nik ?? null;
                    savedPartNumber = parsed.selectedPartNumber ?? parsed.finishGood?.PartNumber ?? null;

                    setStationConfig({
                        selectedNik: savedNik,
                        selectedPartNumber: savedPartNumber,
                        manpower: parsed.manpower ?? null,
                        finishGood: parsed.finishGood ?? null,
                    });
                }
            }
        } catch (e) {
            console.error('Failed to parse display configuration from localStorage', e);
        }

        // Always fetch latest data from API on every mount / page reload
        void refreshDataFromApi(savedNik, savedPartNumber);

        // Auto sync with latest API data every 60 seconds
        const dataInterval = setInterval(() => {
            void refreshDataFromApi();
        }, 60000);

        return () => clearInterval(dataInterval);
    }, [refreshDataFromApi]);

    // Sync form values when modal opens
    useEffect(() => {
        if (isConfigOpen) {
            form.setFieldsValue({
                nik: stationConfig.selectedNik ?? stationConfig.manpower?.Nik ?? undefined,
                partNumber: stationConfig.selectedPartNumber ?? stationConfig.finishGood?.PartNumber ?? undefined,
            });
        }
    }, [isConfigOpen, stationConfig, form]);

    // Fetch the active media config for the selected manpower line and refresh every 60s
    useEffect(() => {
        const line = stationConfig.manpower?.Line;
        void dispatch(fetchActiveDisplayConfig(line));
        const videoInterval = setInterval(() => {
            void dispatch(fetchActiveDisplayConfig(line));
        }, 60000);
        return () => clearInterval(videoInterval);
    }, [dispatch, stationConfig.manpower?.Line]);

    // Keep the target synchronized with the selected part and active production release.
    useEffect(() => {
        const partNumber = stationConfig.selectedPartNumber ?? stationConfig.finishGood?.PartNumber;

        if (!partNumber) {
            dispatch(clearDisplayTarget());
            return;
        }

        void dispatch(fetchDisplayTarget(partNumber));
        const targetInterval = setInterval(() => {
            void dispatch(fetchDisplayTarget(partNumber));
        }, 60000);

        return () => clearInterval(targetInterval);
    }, [dispatch, stationConfig.finishGood?.PartNumber, stationConfig.selectedPartNumber]);

    const handleOpenReportModal = (tab: 'form' | 'history' = 'form') => {
        setReportInitialTab(tab);
        setIsReportOpen(true);
    };

    const handleOpenConfig = () => {
        if (assemblyLocked) {
            message.warning("Complete or cancel the active assembly before changing station settings. Refresh session if offline.");
            return;
        }
        setIsConfigOpen(true);
        setLoadingOptions(true);
        void refreshDataFromApi().finally(() => setLoadingOptions(false));
    };

    const handleSaveConfig = () => {
        if (assemblyLocked) return;
        const values = form.getFieldsValue();
        const selectedMp = manPowerList.find((m) => m.Nik === values.nik) || null;
        const selectedFg = finishGoodsList.find((f) => f.PartNumber === values.partNumber) || null;

        const newConfig: DisplayStationConfig = {
            selectedNik: values.nik ?? null,
            selectedPartNumber: values.partNumber ?? null,
            manpower: selectedMp,
            finishGood: selectedFg,
        };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
            setStationConfig(newConfig);
            message.success('Konfigurasi display berhasil disimpan!');
            setIsConfigOpen(false);
        } catch (err) {
            message.error('Gagal menyimpan konfigurasi: ' + String(err));
        }
    };

    const handleClearConfig = () => {
        if (assemblyLocked) return;
        try {
            localStorage.removeItem(STORAGE_KEY);
            setStationConfig({
                selectedNik: null,
                selectedPartNumber: null,
                manpower: null,
                finishGood: null,
            });
            form.resetFields();
            message.info('Konfigurasi display dibersihkan.');
            setIsConfigOpen(false);
        } catch (err) {
            message.error('Gagal membersihkan konfigurasi: ' + String(err));
        }
    };

    const activeManPower = stationConfig.manpower;
    const activeFinishGood = stationConfig.finishGood;

    // Format date: "16 September 2026"
    const formattedDate = currentTime
        ? currentTime.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })
        : '-';

    // Format time: "HH:mm:ss"
    const formattedTime = currentTime
        ? currentTime.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        })
        : '--:--:--';

    return (
        <>
            {/* Navbar (Light Theme) */}
            <header
                className="flex min-h-14 shrink-0 items-center justify-between gap-2 bg-white px-3 py-2 shadow-xs border-b border-slate-200 z-10 sm:min-h-16 sm:px-6">
                <div className="flex items-center gap-4">
                    <Image
                        src={withBasePath('/images/vtq.png')}
                        alt="Vuteq Indonesia"
                        width={120}
                        height={40}
                        priority
                        className="h-8 w-auto object-contain"
                    />
                    <div className="hidden sm:block h-5 w-px bg-slate-200"/>
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span
                                className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-slate-900 font-extrabold text-base tracking-wider hidden sm:inline">
                            ANSEI PRODUCTION LINE MONITOR
                        </span>
                    </div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-3">
                    <Button
                        type="primary"
                        icon={<FormOutlined/>}
                        onClick={() => handleOpenReportModal('form')}
                        className="bg-blue-600 hover:bg-blue-500 font-semibold shadow-xs"
                    >
                        Input Laporan
                    </Button>
                    <Button
                        danger
                        type="default"
                        icon={<WarningOutlined/>}
                        onClick={() => setIsFindingOpen(true)}
                        className="font-semibold"
                    >
                        Finding / NG
                    </Button>
                    <Button
                        type="default"
                        icon={<HistoryOutlined/>}
                        onClick={() => handleOpenReportModal('history')}
                        className="border-slate-300 text-slate-700 hover:text-blue-600 hover:border-blue-500 font-medium"
                    >
                        Riwayat
                    </Button>
                    <Button
                        type="default"
                        icon={<SettingOutlined/>}
                        onClick={handleOpenConfig}
                        className="border-slate-300 text-slate-700 hover:text-blue-600 hover:border-blue-500 font-medium"
                    >
                        Config
                    </Button>
                    <button
                        type="button"
                        onClick={() => void toggleFullscreen()}
                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    >
                        {isFullscreen ? <FullscreenExitOutlined/> : <FullscreenOutlined/>}
                    </button>
                </div>
            </header>

            {/* Main Display Grid */}
            <section className="min-h-0 flex-1 flex flex-col gap-3.5 overflow-y-auto bg-slate-100 p-2.5 md:grid md:grid-cols-[420px_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden md:p-3.5 lg:grid-cols-[450px_minmax(0,1fr)] xl:grid-cols-[480px_minmax(0,1fr)]">
                {/* Left Column (Operator & Product Info, Skill Matrix, Production Date) */}
                <div
                    className="flex h-auto min-h-0 w-full flex-col gap-3 md:h-full md:w-full md:overflow-hidden">
                    {/* Upper Card: Operator & Product Details (Memanfaatkan Space Secara Maksimal) */}
                    <div
                        className="flex min-h-0 flex-none flex-col items-center justify-between overflow-visible rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-4.5 md:flex-1 md:overflow-y-auto">
                        {/* Special Eye-Catching Line Badge (Mencolok & Menonjol) */}
                        <div
                            className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 p-1 shadow-md shadow-blue-600/20 shrink-0 border border-blue-400/40">
                            {/* Decorative background glow */}
                            <div
                                className="absolute -inset-1 bg-gradient-to-r from-blue-400/10 via-white/15 to-blue-400/10 opacity-70 blur-xs"/>
                            <div
                                className="relative flex items-center justify-center py-2.5 sm:py-3 px-4 rounded-xl border border-white/25 text-center bg-gradient-to-b from-white/10 to-transparent">
                                <span
                                    className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-white drop-shadow-md">
                                    {activeManPower?.Line ? activeManPower.Line : 'LINE -'}
                                </span>
                            </div>
                        </div>

                        {/* Large Employee Photo Frame (Tepat di bawah Nama Line) */}
                        <div
                            className="w-full max-w-[280px] sm:max-w-[310px] aspect-[4/3] max-h-[230px] my-auto rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-inner relative shrink-0">
                            {activeManPower?.PicturePath ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={activeManPower.PicturePath}
                                    alt={activeManPower.Name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                                    <UserOutlined className="text-6xl lg:text-7xl text-slate-300"/>
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        Foto Operator Belum Ada
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Info Boxes Group (Operator & Part dengan Spasi Lebar & Konsisten) */}
                        <div className="w-full flex flex-col gap-3 shrink-0">
                            {/* Operator Info Box (Kotak Informasi Operator) */}
                            <div
                                className="w-full bg-slate-50 rounded-xl py-2.5 px-4 border border-slate-200/80 text-center shadow-2xs">
                                <span
                                    className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">
                                    Operator
                                </span>
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-wide uppercase truncate leading-tight">
                                    {activeManPower?.Name || 'NAMA KARYAWAN'}
                                </h2>
                                <p className="text-xs sm:text-sm font-semibold text-slate-500 tracking-wider mt-0.5">
                                    {activeManPower?.Nik ? `NIK: ${activeManPower.Nik}` : 'NIK: -'}
                                </p>
                            </div>

                            {/* Product Info Card (Kotak Informasi Part) */}
                            <div
                                className="w-full bg-slate-50 rounded-xl py-2.5 px-4 border border-slate-200/80 text-center shadow-2xs">
                                <span
                                    className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">
                                    Part Number
                                </span>
                                <span
                                    className="text-lg sm:text-xl font-black text-blue-700 tracking-wide truncate block">
                                    {activeFinishGood?.PartNumber || '-'}
                                </span>

                                <span
                                    className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider mt-1.5 mb-0.5">
                                    Part Name
                                </span>
                                <span
                                    className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide truncate block">
                                    {activeFinishGood?.PartName || '-'}
                                    {activeFinishGood?.Alias ? (
                                        <span className="text-blue-600 font-bold"> ({activeFinishGood.Alias})</span>
                                    ) : (
                                        ''
                                    )}
                                </span>
                            </div>

                            {/* Target from forecasts linked to the active production release. */}
                            <div
                                className="w-full rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 px-4 text-center shadow-2xs">
                                <span
                                    className="block text-[11px] uppercase text-emerald-600 font-bold tracking-wider mb-0.5">
                                    Target
                                </span>
                                <span
                                    className="block text-2xl sm:text-3xl font-black text-emerald-700 tracking-wide leading-tight">
                                    {targetLoading
                                        ? '...'
                                        : target && target.partNumber === activeFinishGood?.PartNumber
                                            ? target.targetQty.toLocaleString('id-ID')
                                            : '0'}
                                </span>
                                <span
                                    className="block text-[10px] sm:text-xs font-semibold text-emerald-700/75 mt-0.5 truncate">
                                    {targetError
                                        ? 'Target tidak dapat dimuat'
                                        : target?.releaseNumber
                                            ? `Production Release: ${target.releaseNumber}`
                                            : 'Tidak ada production release aktif'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Middle Card: Skill Matrix (Desain Max 3 Kolom Elegan) */}
                    <div
                        className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm shrink-0 flex flex-col">
                        <div className="w-full flex items-center justify-between mb-2.5 px-1">
                            <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-blue-600">
                                SKILL MATRIX
                            </span>
                            <span
                                className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/80">
                                {activeManPower?.SkillMatrix?.length || 0} Kompetensi
                            </span>
                        </div>
                        {activeManPower?.SkillMatrix && activeManPower.SkillMatrix.length > 0 ? (
                            <div className="w-full grid grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-0.5">
                                {activeManPower.SkillMatrix.map((skill) => (
                                    <div
                                        key={skill.Id}
                                        className="bg-slate-50 border border-slate-200/80 rounded-xl py-2 px-1.5 flex flex-col items-center justify-center text-center shadow-2xs"
                                    >
                                        <SkillQuadrantCircle level={skill.Point} size={38}/>
                                        <span
                                            className="text-[11px] font-extrabold text-slate-800 mt-1.5 leading-snug line-clamp-2"
                                            title={skill.Label}>
                                            {skill.Label}
                                        </span>
                                        <span className="text-[10px] font-bold text-blue-600 mt-1">
                                            Level {skill.Point}/4
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div
                                className="flex items-center justify-center w-full h-24 bg-slate-50 border border-slate-200/80 rounded-xl">
                                <span className="text-xs font-semibold text-slate-400">Belum ada Skill Matrix</span>
                            </div>
                        )}
                    </div>

                    {/* Bottom Card: Production Date & Live Clock (Compact & Proporsional) */}
                    <div
                        className="bg-white border border-slate-200/90 rounded-2xl px-4 sm:px-5 py-3 shadow-sm shrink-0 flex items-center justify-between">
                        <div className="flex flex-col text-left">
                            <span className="text-[11px] font-black tracking-widest uppercase text-blue-600">
                                PRODUCTION DATE
                            </span>
                            <span className="text-sm sm:text-base font-black text-slate-800 tracking-wide mt-0.5">
                                {formattedDate}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-2"/>
                        <div className="flex flex-col items-end text-right">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                LIVE TIME
                            </span>
                            <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wider">
                                {formattedTime}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Media Player */}
                <div
                    className="relative flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm md:h-full md:min-h-0">
                    {mediaSource ? (
                        isImageMedia ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={config?.Id}
                                src={mediaSource}
                                alt={config?.Line ? `Display media for ${config.Line}` : 'Display media'}
                                className="h-full w-full object-contain bg-black"
                            />
                        ) : (
                            <video
                                ref={videoRef}
                                key={`${config?.Id}-${mediaSource}`}
                                autoPlay
                                loop={config?.Loop ?? true}
                                muted
                                playsInline
                                className="h-full w-full object-contain bg-black"
                            >
                                <source src={mediaSource}/>
                            </video>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-widest uppercase text-slate-300">
                                MEDIA PLAYER
                            </h2>
                            <p className="text-xs sm:text-sm font-medium text-slate-400">
                                Menunggu video display aktif dari server...
                            </p>
                        </div>
                    )}
                </div>
            </section>

            <AssemblyScanPanel nik={stationConfig.selectedNik ?? stationConfig.manpower?.Nik ?? null}
                               paused={isConfigOpen || isReportOpen || isFindingOpen} onLocked={setAssemblyLocked}
                               getContainer={getOverlayContainer}/>
            {/* Config Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <SettingOutlined className="text-blue-600"/>
                        <span>Display Station Configuration</span>
                    </div>
                }
                open={isConfigOpen}
                onOk={handleSaveConfig}
                onCancel={() => setIsConfigOpen(false)}
                centered={true}
                destroyOnHidden
                okText="Simpan Konfigurasi"
                cancelText="Batal"
                width={540}
                zIndex={1050}
                getContainer={getOverlayContainer}
                footer={[
                    <Button key="clear" danger onClick={handleClearConfig}>
                        Hapus Setting
                    </Button>,
                    <Button key="cancel" onClick={() => setIsConfigOpen(false)}>
                        Batal
                    </Button>,
                    <Button key="save" type="primary" icon={<CheckCircleOutlined/>} onClick={handleSaveConfig}>
                        Simpan
                    </Button>,
                ]}
            >
                <div className="py-2">
                    <p className="text-slate-600 text-sm mb-4">
                        Pilih data <strong>Manpower</strong> dan <strong>Finish Good</strong> untuk ditampilkan pada
                        layar display monitor ini. Setiap halaman di-reload, data terbaru akan selalu disinkronkan dari
                        server.
                    </p>

                    <Spin spinning={loadingOptions}>
                        <Form
                            form={form}
                            layout="vertical"
                            initialValues={{
                                nik: stationConfig.selectedNik ?? stationConfig.manpower?.Nik,
                                partNumber: stationConfig.selectedPartNumber ?? stationConfig.finishGood?.PartNumber,
                            }}
                        >
                            <Form.Item
                                name="nik"
                                label={<span className="font-semibold text-slate-700">Pilih Manpower / Operator</span>}
                                rules={[{required: true, message: 'Harap pilih manpower'}]}
                            >
                                <Select
                                    showSearch={{optionFilterProp: 'label'}}
                                    placeholder="Cari berdasarkan NIK atau Nama..."
                                    options={manPowerList.map((mp) => ({
                                        value: mp.Nik,
                                        label: `[${mp.Nik}] ${mp.Name} - ${mp.Line || 'No Line'}`,
                                        data: mp,
                                    }))}
                                    optionRender={(option) => {
                                        const mp = option.data?.data as DisplayManPower | undefined;
                                        return (
                                            <div className="flex items-center gap-3 py-1">
                                                <Avatar
                                                    src={mp?.PicturePath}
                                                    icon={!mp?.PicturePath ? <UserOutlined/> : undefined}
                                                    size={36}
                                                    shape="square"
                                                    className="shrink-0"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-semibold text-slate-800 truncate">
                                                        {mp?.Name}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <span>NIK: {mp?.Nik}</span>
                                                        {mp?.Line && <Tag color="blue">{mp.Line}</Tag>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                            </Form.Item>

                            <Form.Item
                                name="partNumber"
                                label={<span className="font-semibold text-slate-700">Pilih Finish Good / Produk</span>}
                                rules={[{required: true, message: 'Harap pilih finish good'}]}
                            >
                                <Select
                                    showSearch={{optionFilterProp: 'label'}}
                                    placeholder="Cari berdasarkan Part Number atau Part Name..."
                                    options={finishGoodsList.map((fg) => ({
                                        value: fg.PartNumber,
                                        label: `[${fg.PartNumber}] ${fg.PartName}${fg.Alias ? ` (${fg.Alias})` : ''}`,
                                        data: fg,
                                    }))}
                                    optionRender={(option) => {
                                        const fg = option.data?.data as DisplayFinishGood | undefined;
                                        return (
                                            <div className="flex flex-col py-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-blue-700">{fg?.PartNumber}</span>
                                                    {fg?.Alias && <Tag color="blue">Alias: {fg.Alias}</Tag>}
                                                </div>
                                                <span className="text-xs text-slate-600 truncate">{fg?.PartName}</span>
                                            </div>
                                        );
                                    }}
                                />
                            </Form.Item>

                            <div className="flex justify-end pt-2">
                                <Button
                                    size="small"
                                    icon={<ReloadOutlined/>}
                                    onClick={() => {
                                        setLoadingOptions(true);
                                        void refreshDataFromApi().finally(() => setLoadingOptions(false));
                                    }}
                                    loading={loadingOptions}
                                >
                                    Refresh Opsi
                                </Button>
                            </div>
                        </Form>
                    </Spin>
                </div>
            </Modal>

            <ProductionFindingModal
                open={isFindingOpen}
                onClose={() => setIsFindingOpen(false)}
                reporter={activeManPower?.Name ?? activeManPower?.Nik}
                getContainer={getOverlayContainer}
            />
            {/* Operator Report & History Modal */}
            <OperatorReportModal
                open={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                activeNik={stationConfig.selectedNik ?? stationConfig.manpower?.Nik ?? null}
                activePartNumber={stationConfig.selectedPartNumber ?? stationConfig.finishGood?.PartNumber ?? null}
                manPowerName={activeManPower?.Name}
                finishGoodName={activeFinishGood?.PartName}
                initialTab={reportInitialTab}
                getContainer={getOverlayContainer}
            />
        </>
    );
}

export default function DisplayPage() {
    const displayRef = useRef<HTMLElement>(null);
    const overlayHostRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const getOverlayContainer = useCallback(
        () => overlayHostRef.current ?? displayRef.current ?? document.body,
        [],
    );

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
        <main
            ref={displayRef}
            className="fixed inset-0 flex flex-col overflow-hidden bg-slate-100 font-sans select-none text-slate-800"
        >
            <div ref={overlayHostRef}/>
            <ConfigProvider getPopupContainer={getOverlayContainer} getTargetContainer={getOverlayContainer}>
                <App
                    className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
                    message={{getContainer: getOverlayContainer}}
                >
                    <DisplayPageContent
                        isFullscreen={isFullscreen}
                        getOverlayContainer={getOverlayContainer}
                        toggleFullscreen={toggleFullscreen}
                    />
                </App>
            </ConfigProvider>
        </main>
    );
}
