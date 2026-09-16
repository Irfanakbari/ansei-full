/* By Irfan Akbari Vuteq Indonesia - 2026-08-20 - Updated 2026-09-16 */
'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    FullscreenExitOutlined,
    FullscreenOutlined,
    SettingOutlined,
    UserOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
} from '@ant-design/icons';
import { Button, Modal, Form, Select, App, Spin, Tag, Avatar } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { fetchActiveDisplayConfig } from '@/store/features/display/displaySlice';

export interface DisplayManPower {
    Nik: string;
    Name: string;
    PicturePath: string | null;
    Line: string | null;
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

const DUMMY_SKILL_MATRIX = [
    { id: 1, label: 'Point 1', level: 4 },
    { id: 2, label: 'Point 2', level: 3 },
    { id: 3, label: 'Point 3', level: 4 },
    { id: 4, label: 'Point 4', level: 2 },
    { id: 5, label: 'Point 5', level: 1 },
];

function SkillQuadrantCircle({ level, size = 48 }: { level: number; size?: number }) {
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
            <circle cx="16" cy="16" r="14" fill="#ffffff" />
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
            <line x1="16" y1="2" x2="16" y2="30" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="2" y1="16" x2="30" y2="16" stroke="#94a3b8" strokeWidth="1.5" />
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

export default function DisplayPage() {
    const { message } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const displayRef = useRef<HTMLElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { config } = useSelector((state: RootState) => state.display);

    // Saved configuration (loaded initially from localStorage, then refreshed from API)
    const [stationConfig, setStationConfig] = useState<DisplayStationConfig>({
        selectedNik: null,
        selectedPartNumber: null,
        manpower: null,
        finishGood: null,
    });

    // Modal and options state
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [manPowerList, setManPowerList] = useState<DisplayManPower[]>([]);
    const [finishGoodsList, setFinishGoodsList] = useState<DisplayFinishGood[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(false);

    // Live clock for Production Date & Time
    const [currentTime, setCurrentTime] = useState<Date | null>(null);

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
                    fetch('/api/display/manpower', { cache: 'no-store' }),
                    fetch('/api/display/finish-goods', { cache: 'no-store' }),
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

    // Fetch active video config on mount and refresh every 60s
    useEffect(() => {
        void dispatch(fetchActiveDisplayConfig());
        const videoInterval = setInterval(() => {
            void dispatch(fetchActiveDisplayConfig());
        }, 60000);
        return () => clearInterval(videoInterval);
    }, [dispatch]);

    // Handle fullscreen
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

    const handleOpenConfig = () => {
        setIsConfigOpen(true);
        setLoadingOptions(true);
        void refreshDataFromApi().finally(() => setLoadingOptions(false));
    };

    const handleSaveConfig = () => {
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
        <main
            ref={displayRef}
            className="fixed inset-0 flex flex-col overflow-hidden bg-slate-100 font-sans select-none text-slate-800"
        >
            {/* Navbar (Light Theme) */}
            <header className="flex h-16 shrink-0 items-center justify-between bg-white px-6 shadow-xs border-b border-slate-200 z-10">
                <div className="flex items-center gap-4">
                    <Image
                        src="/images/vtq.png"
                        alt="Vuteq Indonesia"
                        width={120}
                        height={40}
                        priority
                        className="h-8 w-auto object-contain"
                    />
                    <div className="hidden sm:block h-5 w-px bg-slate-200" />
                    <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="text-slate-900 font-extrabold text-base tracking-wider hidden sm:inline">
                            ANSEI PRODUCTION LINE MONITOR
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        type="default"
                        icon={<SettingOutlined />}
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
                        {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                    </button>
                </div>
            </header>

            {/* Main Display Grid */}
            <section className="min-h-0 flex-1 flex flex-col md:flex-row p-3.5 gap-3.5 bg-slate-100">
                {/* Left Column (Operator & Product Info, Skill Matrix, Production Date) */}
                <div className="w-full md:w-[420px] lg:w-[450px] xl:w-[480px] flex flex-col gap-3 shrink-0 h-full min-h-0">
                    {/* Upper Card: Operator & Product Details (Memanfaatkan Space Secara Maksimal) */}
                    <div className="flex-1 min-h-0 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-4.5 flex flex-col items-center justify-between shadow-sm overflow-hidden">
                        {/* Special Eye-Catching Line Badge (Mencolok & Menonjol) */}
                        <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 p-1 shadow-md shadow-blue-600/20 shrink-0 border border-blue-400/40">
                            {/* Decorative background glow */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-400/10 via-white/15 to-blue-400/10 opacity-70 blur-xs" />
                            <div className="relative flex items-center justify-center py-2.5 sm:py-3 px-4 rounded-xl border border-white/25 text-center bg-gradient-to-b from-white/10 to-transparent">
                                <span className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-white drop-shadow-md">
                                    {activeManPower?.Line ? activeManPower.Line : 'LINE -'}
                                </span>
                            </div>
                        </div>

                        {/* Large Employee Photo Frame (Tepat di bawah Nama Line) */}
                        <div className="w-full max-w-[280px] sm:max-w-[310px] aspect-[4/3] max-h-[230px] my-auto rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-inner relative shrink-0">
                            {activeManPower?.PicturePath ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={activeManPower.PicturePath}
                                    alt={activeManPower.Name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                                    <UserOutlined className="text-6xl lg:text-7xl text-slate-300" />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        Foto Operator Belum Ada
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Info Boxes Group (Operator & Part dengan Spasi Lebar & Konsisten) */}
                        <div className="w-full flex flex-col gap-3 shrink-0">
                            {/* Operator Info Box (Kotak Informasi Operator) */}
                            <div className="w-full bg-slate-50 rounded-xl py-2.5 px-4 border border-slate-200/80 text-center shadow-2xs">
                                <span className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">
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
                            <div className="w-full bg-slate-50 rounded-xl py-2.5 px-4 border border-slate-200/80 text-center shadow-2xs">
                                <span className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider mb-0.5">
                                    Part Number
                                </span>
                                <span className="text-lg sm:text-xl font-black text-blue-700 tracking-wide truncate block">
                                    {activeFinishGood?.PartNumber || '-'}
                                </span>

                                <span className="block text-[11px] uppercase text-slate-400 font-bold tracking-wider mt-1.5 mb-0.5">
                                    Part Name
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-wide truncate block">
                                    {activeFinishGood?.PartName || '-'}
                                    {activeFinishGood?.Alias ? (
                                        <span className="text-blue-600 font-bold"> ({activeFinishGood.Alias})</span>
                                    ) : (
                                        ''
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Middle Card: Skill Matrix (Desain 5 Mini-Cards Elegan) */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-sm shrink-0 flex flex-col">
                        <div className="w-full flex items-center justify-between mb-2.5 px-1">
                            <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-blue-600">
                                SKILL MATRIX
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/80">
                                5 Kompetensi
                            </span>
                        </div>
                        <div className="w-full grid grid-cols-5 gap-1.5 sm:gap-2">
                            {DUMMY_SKILL_MATRIX.map((skill) => (
                                <div
                                    key={skill.id}
                                    className="bg-slate-50 border border-slate-200/80 rounded-xl py-2 px-1 flex flex-col items-center justify-center text-center shadow-2xs"
                                >
                                    <SkillQuadrantCircle level={skill.level} size={42} />
                                    <span className="text-[11px] sm:text-xs font-extrabold text-slate-800 mt-1.5 leading-none">
                                        {skill.label}
                                    </span>
                                    <span className="text-[10px] font-bold text-blue-600 mt-1">
                                        Level {skill.level}/4
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Card: Production Date & Live Clock (Compact & Proporsional) */}
                    <div className="bg-white border border-slate-200/90 rounded-2xl px-4 sm:px-5 py-3 shadow-sm shrink-0 flex items-center justify-between">
                        <div className="flex flex-col text-left">
                            <span className="text-[11px] font-black tracking-widest uppercase text-blue-600">
                                PRODUCTION DATE
                            </span>
                            <span className="text-sm sm:text-base font-black text-slate-800 tracking-wide mt-0.5">
                                {formattedDate}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 mx-2" />
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
                <div className="flex-1 h-full min-h-0 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm relative flex items-center justify-center">
                    {config?.Url ? (
                        <video
                            key={config.Id}
                            autoPlay
                            loop={config.Loop ?? true}
                            muted
                            playsInline
                            className="h-full w-full object-contain bg-black"
                        >
                            <source src={config.Url} />
                        </video>
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

            {/* Config Modal */}
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <SettingOutlined className="text-blue-600" />
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
                footer={[
                    <Button key="clear" danger onClick={handleClearConfig}>
                        Hapus Setting
                    </Button>,
                    <Button key="cancel" onClick={() => setIsConfigOpen(false)}>
                        Batal
                    </Button>,
                    <Button key="save" type="primary" icon={<CheckCircleOutlined />} onClick={handleSaveConfig}>
                        Simpan
                    </Button>,
                ]}
            >
                <div className="py-2">
                    <p className="text-slate-600 text-sm mb-4">
                        Pilih data <strong>Manpower</strong> dan <strong>Finish Good</strong> untuk ditampilkan pada layar display monitor ini. Setiap halaman di-reload, data terbaru akan selalu disinkronkan dari server.
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
                                rules={[{ required: true, message: 'Harap pilih manpower' }]}
                            >
                                <Select
                                    showSearch
                                    placeholder="Cari berdasarkan NIK atau Nama..."
                                    optionFilterProp="label"
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
                                                    icon={!mp?.PicturePath ? <UserOutlined /> : undefined}
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
                                rules={[{ required: true, message: 'Harap pilih finish good' }]}
                            >
                                <Select
                                    showSearch
                                    placeholder="Cari berdasarkan Part Number atau Part Name..."
                                    optionFilterProp="label"
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
                                    icon={<ReloadOutlined />}
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
        </main>
    );
}
