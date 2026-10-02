/* By Irfan Akbari Vuteq Indonesia - 2026-07-24 */
"use client";

import React, { useState } from 'react';
import {
    Table,
    Card,
    Breadcrumb,
    Button,
    Space,
    DatePicker,
    Select,
    App,
} from 'antd';
import {
    DownloadOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface ReportItem {
    key: string;
    name: string;
    description: string;
    hasDateFilter: boolean;
    hasCategoryFilter: boolean;
    hasLocationFilter: boolean;
}

const reports: ReportItem[] = [
    {
        key: 'stock-material',
        name: 'Stock Material Report',
        description: 'Semua material aktif dengan informasi stock',
        hasDateFilter: false,
        hasCategoryFilter: false,
        hasLocationFilter: false,
    },
    {
        key: 'incoming-warehouse',
        name: 'Incoming Warehouse Report',
        description: 'Data incoming warehouse dengan filter tanggal',
        hasDateFilter: true,
        hasCategoryFilter: false,
        hasLocationFilter: false,
    },
    {
        key: 'incoming-rack',
        name: 'Incoming Rack Report',
        description: 'Data transfer to rack dengan filter tanggal',
        hasDateFilter: true,
        hasCategoryFilter: false,
        hasLocationFilter: false,
    },
    {
        key: 'transfer-material',
        name: 'Transfer Material Report',
        description: 'Delivery note material dengan filter tanggal',
        hasDateFilter: true,
        hasCategoryFilter: false,
        hasLocationFilter: false,
    },
    {
        key: 'production-release',
        name: 'Production Release Report',
        description: 'Data production release dengan filter tanggal',
        hasDateFilter: true,
        hasCategoryFilter: false,
        hasLocationFilter: false,
    },
    {
        key: 'pokayoke-scan',
        name: 'Pokayoke Scan Report',
        description: 'History scan pokayoke dengan filter tanggal',
        hasDateFilter: true,
        hasCategoryFilter: false,
        hasLocationFilter: false,
    },
    {
        key: 'delivery-history',
        name: 'Delivery History Report',
        description: 'History delivery dengan filter tanggal',
        hasDateFilter: true,
        hasCategoryFilter: false,
        hasLocationFilter: false,
    },
    {
        key: 'production-report',
        name: 'Production Report',
        description: 'Data laporan produksi dengan filter tanggal',
        hasDateFilter: true,
        hasCategoryFilter: false,
        hasLocationFilter: false,
    },
    {
        key: 'shopping-history',
        name: 'Shopping History Report',
        description: 'History shopping/picking dengan filter tanggal',
        hasDateFilter: true,
        hasCategoryFilter: false,
        hasLocationFilter: false,
    },
    {
        key: 'inventory-ledger',
        name: 'Inventory Ledger Report',
        description: 'Buku besar inventory dengan filter tanggal, kategori, dan lokasi',
        hasDateFilter: true,
        hasCategoryFilter: true,
        hasLocationFilter: true,
    },
];

const ReportPage: React.FC = () => {
    const { message } = App.useApp();
    const [downloading, setDownloading] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
    const [category, setCategory] = useState<string | undefined>(undefined);
    const [location, setLocation] = useState<string | undefined>(undefined);

    const handleDownload = async (report: ReportItem) => {
        try {
            setDownloading(report.key);

            // Build query params
            const params = new URLSearchParams();

            if (report.hasDateFilter && dateRange && dateRange[0] && dateRange[1]) {
                params.append('fromdate', dateRange[0].format('DDMMYYYY'));
                params.append('todate', dateRange[1].format('DDMMYYYY'));
            }

            if (report.hasCategoryFilter && category) {
                params.append('category', category);
            }

            if (report.hasLocationFilter && location) {
                params.append('location', location);
            }

            const queryString = params.toString();
            const url = queryString
                ? `/api/proxy/v1/report/${report.key}?${queryString}`
                : `/api/proxy/v1/report/${report.key}`;

            const response = await fetch(url, {
                method: 'GET',
                credentials: 'include',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to download report');
            }

            // Get filename from content-disposition or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `${report.name.replace(/\s+/g, '_')}_${dayjs().format('YYYY-MM-DD')}.xlsx`;

            if (contentDisposition) {
                const match = contentDisposition.match(/filename=(.+)/);
                if (match) {
                    filename = match[1].replace(/"/g, '');
                }
            }

            // Download file
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            message.success(`${report.name} downloaded successfully`);
        } catch (error: unknown) {
            const err = error as Error;
            message.error(err?.message || 'Failed to download report');
        } finally {
            setDownloading(null);
        }
    };

    const handleClearFilters = () => {
        setDateRange(null);
        setCategory(undefined);
        setLocation(undefined);
    };

    const columns: any[] = [
        {
            title: '#',
            key: 'index',
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Report Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <strong>{text}</strong>,
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Filters',
            key: 'filters',
            render: (_: any, record: ReportItem) => (
                <Space size="small">
                    {record.hasDateFilter && (
                        <span className="ant-tag ant-tag-orange">Date Range</span>
                    )}
                    {record.hasCategoryFilter && (
                        <span className="ant-tag ant-tag-blue">Category</span>
                    )}
                    {record.hasLocationFilter && (
                        <span className="ant-tag ant-tag-green">Location</span>
                    )}
                    {!record.hasDateFilter && !record.hasCategoryFilter && !record.hasLocationFilter && (
                        <span className="ant-tag ant-tag-gray">No Filter</span>
                    )}
                </Space>
            ),
        },
        {
            title: 'Action',
            key: 'action',
            align: 'center' as const,
            render: (_: any, record: ReportItem) => (
                <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    loading={downloading === record.key}
                    onClick={() => handleDownload(record)}
                    size="small"
                >
                    Download
                </Button>
            ),
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb
                style={{ marginBottom: 16 }}
                items={[
                    { title: 'Home' },
                    { title: 'Report' },
                ]}
            />

            <ToolbarWrapper>
                <Space wrap size="middle">
                    <RangePicker
                        value={dateRange}
                        onChange={(dates) => setDateRange(dates)}
                        format="DD/MM/YYYY"
                        placeholder={['Start Date', 'End Date']}
                        allowClear
                        size="small"
                    />
                    <Select
                        placeholder="Category"
                        value={category}
                        onChange={setCategory}
                        allowClear
                        style={{ width: 140 }}
                        size="small"
                        options={[
                            { value: 'MATERIAL', label: 'Material' },
                            { value: 'FINISH_GOOD', label: 'Finish Good' },
                        ]}
                    />
                    <Select
                        placeholder="Location"
                        value={location}
                        onChange={setLocation}
                        allowClear
                        style={{ width: 160 }}
                        size="small"
                        options={[
                            { value: 'WAREHOUSE', label: 'Warehouse' },
                            { value: 'RACK', label: 'Rack' },
                            { value: 'FINISH_GOOD_AREA', label: 'Finish Good Area' },
                        ]}
                    />
                    <ButtonToolbar
                        title="Clear Filters"
                        icon={<ReloadOutlined />}
                        onClick={handleClearFilters}
                    />
                </Space>
            </ToolbarWrapper>

            <Table
                columns={columns}
                dataSource={reports}
                rowKey="key"
                pagination={false}
                size="small"
                scroll={{ x: 'max-content', y: 'calc(100vh - 320px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />
        </Card>
    );
};

export default ReportPage;
