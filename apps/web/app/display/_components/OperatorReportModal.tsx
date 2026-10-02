/* By Irfan Akbari Vuteq Indonesia - 2026-09-16 */
'use client';

import {useDispatch as useCommandDispatch} from 'react-redux';
import type {AppDispatch as CommandDispatch} from '@/store';
import {createProductionReport} from '@/store/features/production/productionReport/productionReportSlice';
import {useVuteqSso} from '@vuteq/sso-client-react/react';
import React, {useState, useEffect, useCallback} from 'react';
import {
    Modal,
    Form,
    Input,
    InputNumber,
    Select,
    DatePicker,
    Button,
    Tabs,
    Table,
    Tag,
    Space,
    App,
    Collapse,
    Empty,
} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {
    FormOutlined,
    HistoryOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    BarcodeOutlined,
    UserOutlined,
    AppstoreOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

export interface ActiveForecastItem {
    poId: string;
    poNumber: string;
    finishGoodId: string;
    partName: string;
    deliveryDate: string;
    qty: number;
    vendorName: string;
    releaseNumber: string;
}

export interface OperatorReportItem {
    id: number;
    date: string | null;
    time: string | null;
    productionStamp: string;
    qty: number;
    ngQty: number;
    recordType: string;
    finishGoodId: string;
    partName: string;
    forecastId: string | null;
    poNumber: string | null;
    vendorName: string | null;
    validatedAt: string | null;
    validatedBy: string | null;
    createdAt: string;
    startTime: string | null;
    endTime: string | null;
    stopMinute: number | null;
}

interface Props {
    open: boolean;
    onClose: () => void;
    activeNik: string | null;
    activePartNumber: string | null;
    manPowerName?: string | null;
    finishGoodName?: string | null;
    initialTab?: 'form' | 'history';
    getContainer: () => HTMLElement;
}

const PART_TYPE_OPTIONS = [
    {value: 'ONE', label: 'ONE'},
    {value: 'TWO', label: 'TWO'},
    {value: 'THREE', label: 'THREE'},
    {value: 'FOUR', label: 'FOUR'},
];

const RECORD_TYPE_COLORS: Record<string, string> = {
    ONE: 'blue',
    TWO: 'green',
    THREE: 'orange',
    FOUR: 'purple',
};

export default function OperatorReportModal({
                                                open,
                                                onClose,
                                                activeNik,
                                                activePartNumber,
                                                manPowerName,
                                                finishGoodName,
                                                initialTab = 'form',
                                                getContainer,
                                            }: Props) {
    const {message} = App.useApp();
    const {session, loading: sessionLoading} = useVuteqSso();
    const canCreateReport = !!session && (
        session.globalRoles.includes('SUPER_ADMINISTRATOR') ||
        session.roles.includes('SUPER') || session.permissions.includes('SUPER') ||
        session.permissions.includes('IPCS.PRODUCTION_REPORT_CREATE')
    );
    const [activeTab, setActiveTab] = useState<'form' | 'history'>(initialTab);
    const commandDispatch = useCommandDispatch<CommandDispatch>();
    const [form] = Form.useForm();

    // State for forecasts dropdown
    const [forecasts, setForecasts] = useState<ActiveForecastItem[]>([]);
    const [loadingForecasts, setLoadingForecasts] = useState(false);
    const [selectedForecast, setSelectedForecast] = useState<ActiveForecastItem | null>(null);

    // State for submitting report
    const [submitting, setSubmitting] = useState(false);

    // State for history
    const [historyList, setHistoryList] = useState<OperatorReportItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyDate, setHistoryDate] = useState<dayjs.Dayjs | null>(dayjs());

    // Sync tab when initialTab changes or modal opens
    useEffect(() => {
        if (open) {
            setActiveTab(initialTab);
        }
    }, [open, initialTab]);

    // Fetch active forecasts that passed Pokayoke
    const fetchActiveForecasts = useCallback(async () => {
        if (!activePartNumber) return;
        setLoadingForecasts(true);
        try {
            const res = await fetch(
                `/api/display/active-forecasts?finishGoodId=${encodeURIComponent(activePartNumber)}`,
                {cache: 'no-store'},
            );
            if (res.ok) {
                const data = await res.json();
                setForecasts(Array.isArray(data) ? data : []);
            } else {
                setForecasts([]);
            }
        } catch {
            setForecasts([]);
        } finally {
            setLoadingForecasts(false);
        }
    }, [activePartNumber]);

    // Fetch operator history
    const fetchHistory = useCallback(async () => {
        if (!activeNik) return;
        setLoadingHistory(true);
        try {
            const dateStr = historyDate ? historyDate.format('YYYY-MM-DD') : '';
            const queryParams = new URLSearchParams({nik: activeNik, limit: '50'});
            if (dateStr) {
                queryParams.set('date', dateStr);
            }

            const res = await fetch(
                `/api/display/production-report?${queryParams.toString()}`,
                {cache: 'no-store'},
            );
            if (res.ok) {
                const json = await res.json();
                setHistoryList(Array.isArray(json.data) ? json.data : []);
            } else {
                setHistoryList([]);
            }
        } catch {
            setHistoryList([]);
        } finally {
            setLoadingHistory(false);
        }
    }, [activeNik, historyDate]);

    // Refresh when modal opens
    useEffect(() => {
        if (open) {
            void fetchActiveForecasts();
            void fetchHistory();
            form.setFieldsValue({
                date: dayjs(),
                time: dayjs().format('HH:mm:ss'),
                recordType: 'ONE',
                qty: undefined,
                ngQty: 0,
                stopMinute: 0,
            });
            setSelectedForecast(null);
        }
    }, [open, fetchActiveForecasts, fetchHistory, form]);

    // Handle submit production report
    const handleSubmit = async () => {
        if (!activeNik) {
            message.error('NIK Operator belum dikonfigurasi di display monitor!');
            return;
        }
        if (!activePartNumber) {
            message.error('Part Number Finish Good belum dikonfigurasi di display monitor!');
            return;
        }

        try {
            const values = await form.validateFields();
            setSubmitting(true);

            const now = new Date();
            const dateStr = values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
            const timeStr = values.time || dayjs().format('HH:mm:ss');

            const payload = {
                date: dateStr,
                time: timeStr,
                productionStamp: now.toISOString(),
                manPowerUid: activeNik,
                finishGoodId: activePartNumber,
                forecastId: values.forecastId,
                poId: values.forecastId,
                poNumber: selectedForecast?.poNumber || values.forecastId,
                qty: Number(values.qty),
                ngQty: Number(values.ngQty || 0),
                recordType: values.recordType || 'ONE',
                startTime: values.startTime || undefined,
                endTime: values.endTime || undefined,
                stopMinute: values.stopMinute !== undefined ? Number(values.stopMinute) : 0,
                latchDate: values.latchDate ? values.latchDate.format('YYYY-MM-DD') : undefined,
                cableHDate: values.cableHDate ? values.cableHDate.format('YYYY-MM-DD') : undefined,
                cableLDate: values.cableLDate ? values.cableLDate.format('YYYY-MM-DD') : undefined,
                coverDate: values.coverDate ? values.coverDate.format('YYYY-MM-DD') : undefined,
                rodDate: values.rodDate ? values.rodDate.format('YYYY-MM-DD') : undefined,
                sponsDate: values.sponsDate ? values.sponsDate.format('YYYY-MM-DD') : undefined,
                sponsRearDate: values.sponsRearDate ? values.sponsRearDate.format('YYYY-MM-DD') : undefined,
                clipDate: values.clipDate ? values.clipDate.format('YYYY-MM-DD') : undefined,
                leverDate: values.leverDate ? values.leverDate.format('YYYY-MM-DD') : undefined,
                smallPadDate: values.smallPadDate ? values.smallPadDate.format('YYYY-MM-DD') : undefined,
                actuatorDate: values.actuatorDate ? values.actuatorDate.format('YYYY-MM-DD') : undefined,
                backPlateDate: values.backPlateDate ? values.backPlateDate.format('YYYY-MM-DD') : undefined,
                stampDate: values.stampDate ? values.stampDate.format('YYYY-MM-DD') : undefined,
            };

            await commandDispatch(createProductionReport(payload)).unwrap();

            message.success('Laporan produksi berhasil disimpan!');
            form.resetFields();
            setSelectedForecast(null);

            // Switch to history tab and refresh
            setActiveTab('history');
            void fetchHistory();
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            message.error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    const historyColumns: ColumnsType<OperatorReportItem> = [
        {
            title: 'Waktu',
            key: 'time',
            width: 130,
            render: (_, record) => (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-800">{record.date || '-'}</span>
                    <span className="text-xs text-slate-500">{record.time || '-'}</span>
                </div>
            ),
        },
        {
            title: 'PO ID / Forecast',
            dataIndex: 'forecastId',
            key: 'forecastId',
            render: (val, record) => (
                <div className="flex flex-col">
                    <span className="font-bold text-blue-700">{val || record.poNumber || '-'}</span>
                    {record.vendorName && <span className="text-xs text-slate-400">{record.vendorName}</span>}
                </div>
            ),
        },
        {
            title: 'Part Number',
            key: 'finishGood',
            render: (_, record) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">{record.finishGoodId}</span>
                    <span className="text-xs text-slate-500 truncate max-w-[150px]">{record.partName}</span>
                </div>
            ),
        },
        {
            title: 'Type',
            dataIndex: 'recordType',
            key: 'recordType',
            width: 80,
            render: (val: string) => (
                <Tag color={RECORD_TYPE_COLORS[val] || 'default'}>{val}</Tag>
            ),
        },
        {
            title: 'Good Qty',
            dataIndex: 'qty',
            key: 'qty',
            align: 'right',
            render: (val: number) => (
                <span className="font-extrabold text-emerald-600">{val.toLocaleString('id-ID')}</span>
            ),
        },
        {
            title: 'NG Qty',
            dataIndex: 'ngQty',
            key: 'ngQty',
            align: 'right',
            render: (val: number) => (
                <span className={val > 0 ? 'font-bold text-red-600' : 'text-slate-400'}>
                    {val.toLocaleString('id-ID')}
                </span>
            ),
        },
        {
            title: 'Status',
            key: 'status',
            width: 110,
            render: (_, record) =>
                record.validatedAt ? (
                    <Tag color="success">Validated</Tag>
                ) : (
                    <Tag color="warning">Pending</Tag>
                ),
        },
    ];

    return (
        <Modal
            open={open}
            onCancel={onClose}
            centered={true}
            destroyOnHidden
            width={880}
            zIndex={1050}
            getContainer={getContainer}
            styles={{
                body: {
                    maxHeight: 'calc(85vh - 120px)',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: '6px',
                },
            }}
            title={
                <div className="flex items-center gap-2 text-slate-800 font-bold text-base sm:text-lg">
                    <FormOutlined className="text-blue-600"/>
                    <span>Input & Riwayat Laporan Produksi Operator</span>
                </div>
            }
            footer={
                activeTab === 'form' ? (
                    <div className="flex justify-between items-center w-full">
                        <Button
                            icon={<HistoryOutlined/>}
                            onClick={() => setActiveTab('history')}
                        >
                            Lihat Riwayat Saya
                        </Button>
                        <Space>
                            <Button onClick={onClose}>Batal</Button>
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined/>}
                                loading={submitting}
                                disabled={sessionLoading || (!!session && !canCreateReport)}
                                href={!session && !sessionLoading ? '/auth/login' : undefined}
                                title={!canCreateReport ? 'Login with production report creation permission to save a report' : undefined}
                                onClick={session ? handleSubmit : undefined}
                            >
                                {session ? 'Simpan Laporan' : 'Login untuk menyimpan'}
                            </Button>
                        </Space>
                    </div>
                ) : (
                    <div className="flex justify-between items-center w-full">
                        <Button
                            icon={<FormOutlined/>}
                            type="primary"
                            onClick={() => setActiveTab('form')}
                        >
                            Input Laporan Baru
                        </Button>
                        <Button onClick={onClose}>Tutup</Button>
                    </div>
                )
            }
        >
            {/* Operator & Part Info Card (Sleek Compact Single Row) */}
            <div
                className="mb-3 rounded-xl bg-gradient-to-r from-slate-50 via-slate-50 to-blue-50/40 border border-slate-200/80 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <UserOutlined className="text-base"/>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Operator
                        </span>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                            {manPowerName ? `${manPowerName} [${activeNik}]` : activeNik || 'Belum dipilih'}
                        </span>
                    </div>
                </div>

                <div className="hidden sm:block h-6 w-px bg-slate-200"/>

                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <AppstoreOutlined className="text-base"/>
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Finish Good
                        </span>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                            {activePartNumber ? `${activePartNumber} - ${finishGoodName || ''}` : 'Belum dipilih'}
                        </span>
                    </div>
                </div>
            </div>

            <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as 'form' | 'history')}
                items={[
                    {
                        key: 'form',
                        label: (
                            <span className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm">
                                <FormOutlined/> Input Laporan
                            </span>
                        ),
                        children: (
                            <Form form={form} layout="vertical" className="pt-1">
                                {/* Forecast / PO ID selection */}
                                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 mb-3">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <BarcodeOutlined className="text-blue-600 text-base"/>
                                            <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                                Pilih Forecast / PO ID Produksi
                                            </span>
                                        </div>
                                        <Button
                                            size="small"
                                            icon={<ReloadOutlined/>}
                                            onClick={() => void fetchActiveForecasts()}
                                            loading={loadingForecasts}
                                        >
                                            Refresh PO
                                        </Button>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mb-2">
                                        Hanya Forecast yang sudah berstatus <strong>SUKSES scan Pokayoke</strong> dan
                                        jadwal Production Release-nya <strong>belum closed (RELEASED)</strong> yang
                                        dapat dipilih.
                                    </p>

                                    <Form.Item
                                        name="forecastId"
                                        rules={[{required: true, message: 'Harap pilih atau masukkan PO ID'}]}
                                        className="!mb-0"
                                    >
                                        <Select
                                            showSearch={{optionFilterProp: 'label'}}
                                            placeholder="Pilih PO ID yang sudah lulus Pokayoke & status RELEASED..."
                                            loading={loadingForecasts}
                                            onChange={(val) => {
                                                const match = forecasts.find((f) => f.poId === val);
                                                setSelectedForecast(match || null);
                                            }}
                                            options={forecasts.map((f) => ({
                                                value: f.poId,
                                                label: `[${f.poId}] ${f.partName} - Target: ${f.qty} (Vendor: ${f.vendorName})`,
                                                data: f,
                                            }))}
                                            notFoundContent={
                                                loadingForecasts ? undefined : (
                                                    <div className="py-2 text-center text-xs text-slate-400">
                                                        Tidak ada Forecast aktif untuk part ini yang sudah selesai
                                                        Pokayoke.
                                                    </div>
                                                )
                                            }
                                        />
                                    </Form.Item>

                                    {selectedForecast && (
                                        <div
                                            className="mt-2 bg-white rounded-lg px-2.5 py-1.5 border border-blue-200 flex flex-wrap items-center justify-between text-xs gap-1.5">
                                            <div>
                                                <span className="text-slate-500">Release: </span>
                                                <strong
                                                    className="text-blue-700">{selectedForecast.releaseNumber}</strong>
                                                <span className="mx-2 text-slate-300">|</span>
                                                <span className="text-slate-500">Target PO: </span>
                                                <strong className="text-slate-800">{selectedForecast.qty} pcs</strong>
                                            </div>
                                            <Tag color="success">Pokayoke Verified</Tag>
                                        </div>
                                    )}
                                </div>

                                {/* Main Production Info (Row 1: 4 Columns) */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-1">
                                    <Form.Item
                                        name="date"
                                        label={<span className="text-xs font-semibold text-slate-700">Tanggal</span>}
                                        rules={[{required: true, message: 'Harap pilih tanggal'}]}
                                        className="!mb-2.5"
                                    >
                                        <DatePicker className="w-full" format="YYYY-MM-DD"/>
                                    </Form.Item>

                                    <Form.Item
                                        name="time"
                                        label={<span
                                            className="text-xs font-semibold text-slate-700">Waktu (HH:mm:ss)</span>}
                                        className="!mb-2.5"
                                    >
                                        <Input placeholder="HH:mm:ss"/>
                                    </Form.Item>

                                    <Form.Item
                                        name="qty"
                                        label={<span
                                            className="text-xs font-semibold text-emerald-700">Good Qty (Bagus)</span>}
                                        rules={[{required: true, message: 'Wajib diisi'}]}
                                        className="!mb-2.5"
                                    >
                                        <InputNumber
                                            placeholder="0"
                                            min={1}
                                            className="w-full font-bold text-emerald-700"
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        name="ngQty"
                                        label={<span
                                            className="text-xs font-semibold text-red-600">NG Qty (Rusak)</span>}
                                        className="!mb-2.5"
                                    >
                                        <InputNumber
                                            placeholder="0"
                                            min={0}
                                            className="w-full font-semibold text-red-600"
                                        />
                                    </Form.Item>
                                </div>

                                {/* Main Production Info (Row 2: 4 Columns) */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2.5">
                                    <Form.Item
                                        name="recordType"
                                        label={<span className="text-xs font-semibold text-slate-700">Part Type</span>}
                                        rules={[{required: true, message: 'Pilih part type'}]}
                                        className="!mb-2"
                                    >
                                        <Select options={PART_TYPE_OPTIONS}/>
                                    </Form.Item>

                                    <Form.Item
                                        name="startTime"
                                        label={<span className="text-xs font-semibold text-slate-600">Jam Mulai</span>}
                                        className="!mb-2"
                                    >
                                        <Input type="time" className="w-full"/>
                                    </Form.Item>

                                    <Form.Item
                                        name="endTime"
                                        label={<span
                                            className="text-xs font-semibold text-slate-600">Jam Selesai</span>}
                                        className="!mb-2"
                                    >
                                        <Input type="time" className="w-full"/>
                                    </Form.Item>

                                    <Form.Item
                                        name="stopMinute"
                                        label={<span
                                            className="text-xs font-semibold text-slate-600">Stop (Menit)</span>}
                                        className="!mb-2"
                                    >
                                        <InputNumber min={0} className="w-full" placeholder="0"/>
                                    </Form.Item>
                                </div>

                                {/* Collapsible Traceability Details (Compact 5 Columns) */}
                                <Collapse
                                    size="small"
                                    className="bg-slate-50/70 border border-slate-200/80 rounded-xl"
                                    items={[
                                        {
                                            key: 'traceability',
                                            label: (
                                                <span
                                                    className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                                    <ClockCircleOutlined className="text-blue-500"/>
                                                    Tanggal Komponen Traceability (Opsional)
                                                </span>
                                            ),
                                            children: (
                                                <div
                                                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 pt-1">
                                                    <Form.Item name="latchDate" label={<span
                                                        className="text-[11px] text-slate-600">Latch</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="cableHDate"
                                                               label={<span className="text-[11px] text-slate-600">Cable H</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="cableLDate"
                                                               label={<span className="text-[11px] text-slate-600">Cable L</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="coverDate" label={<span
                                                        className="text-[11px] text-slate-600">Cover</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="rodDate" label={<span
                                                        className="text-[11px] text-slate-600">Rod</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="sponsDate" label={<span
                                                        className="text-[11px] text-slate-600">Spons</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="sponsRearDate"
                                                               label={<span className="text-[11px] text-slate-600">Spons Rear</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="clipDate" label={<span
                                                        className="text-[11px] text-slate-600">Clip</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="leverDate" label={<span
                                                        className="text-[11px] text-slate-600">Lever</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="smallPadDate"
                                                               label={<span className="text-[11px] text-slate-600">Small Pad</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="actuatorDate" label={<span
                                                        className="text-[11px] text-slate-600">Actuator</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="backPlateDate"
                                                               label={<span className="text-[11px] text-slate-600">Back Plate</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                    <Form.Item name="stampDate" label={<span
                                                        className="text-[11px] text-slate-600">Stamp</span>}
                                                               className="!mb-1">
                                                        <DatePicker size="small" className="w-full"
                                                                    format="YYYY-MM-DD"/>
                                                    </Form.Item>
                                                </div>
                                            ),
                                        },
                                    ]}
                                />
                            </Form>
                        ),
                    },
                    {
                        key: 'history',
                        label: (
                            <span className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm">
                                <HistoryOutlined/> Riwayat Saya
                            </span>
                        ),
                        children: (
                            <div className="pt-1 flex flex-col gap-2.5">
                                <div
                                    className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-600">Filter Tanggal:</span>
                                        <DatePicker
                                            value={historyDate}
                                            onChange={(date) => setHistoryDate(date)}
                                            format="YYYY-MM-DD"
                                            allowClear
                                            placeholder="Semua Tanggal"
                                        />
                                    </div>
                                    <Button
                                        size="small"
                                        icon={<ReloadOutlined/>}
                                        onClick={() => void fetchHistory()}
                                        loading={loadingHistory}
                                    >
                                        Muat Ulang
                                    </Button>
                                </div>

                                <Table
                                    columns={historyColumns}
                                    dataSource={historyList}
                                    rowKey="id"
                                    loading={loadingHistory}
                                    pagination={{pageSize: 5}}
                                    size="small"
                                    scroll={{x: 600}}
                                    locale={{
                                        emptyText: (
                                            <Empty
                                                description="Belum ada riwayat laporan produksi untuk NIK ini"
                                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            />
                                        ),
                                    }}
                                />
                            </div>
                        ),
                    },
                ]}
            />
        </Modal>
    );
}
