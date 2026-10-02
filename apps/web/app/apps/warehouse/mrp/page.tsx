/* By Irfan Akbari Vuteq Indonesia - 2026-06-18 */
"use client";

import React, { useEffect } from 'react';
import { Card, Breadcrumb, Table, Tag, Button, Empty, Tooltip, App } from 'antd';
import type { TableProps } from 'antd';
import { CalculatorOutlined, DownloadOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { calculateMRP, clearMRP } from '@/store/features/warehouse/mrp/mrpSlice';
import { withBasePath } from '@/lib/base-path';

interface DailyDemand {
    date: string;
    demand: number;
    lack: number;
}

interface MaterialMRP {
    materialId: number;
    partNumber: string;
    partName: string;
    supplier: string;
    rackLocation: string;
    qtyRack: number;
    qtyWarehouse: number;
    qtyPending: number;
    qtyReserved?: number;
    qtyCurrentTotal: number;
    dailyDemand: DailyDemand[];
}

const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
    });
};

const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function MRPPage() {
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, error } = useSelector((state: RootState) => state.mrp);
    const { message } = App.useApp();

    useEffect(() => {
        return () => {
            dispatch(clearMRP());
        };
    }, [dispatch]);

    const handleCalculate = () => {
        dispatch(calculateMRP());
    };

    const handleExport = async () => {
        try {
            message.loading({ content: 'Exporting MRP data...', key: 'export' });

            const response = await fetch(withBasePath('/api/warehouse/mrp/export'), {
                method: 'POST',
            });

            if (!response.ok) {
                const errorData = await response.json();
                message.error({ content: errorData.message || 'Gagal export MRP', key: 'export' });
                return;
            }

            // Get the blob and download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'mrp-export.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            message.success({ content: 'MRP exported successfully', key: 'export' });
        } catch (error: any) {
            message.error({ content: error.message || 'Gagal export MRP', key: 'export' });
        }
    };

    // Generate dynamic columns based on dateRange
    const generateColumns = (): TableProps<MaterialMRP>['columns'] => {
        if (!data?.dateRange) return [];

        const dates = data.dateRange;
        const startDate = new Date(dates.startDate);
        const endDate = new Date(dates.endDate);
        const dateColumns: { date: string; dateStr: string }[] = [];

        // Generate array of dates from start to end
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            dateColumns.push({ date: d.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' }), dateStr });
        }

        const baseColumns: TableProps<MaterialMRP>['columns'] = [
            {
                title: 'No',
                key: 'index',
                width: 60,
                fixed: 'left' as const,
                align: 'center' as const,
                render: (_, __, index) => index + 1,
            },
            {
                title: 'Part Number',
                dataIndex: 'partNumber',
                key: 'partNumber',
                width: 120,
                fixed: 'left' as const,
                render: (text: string) => (
                    <code style={{ fontSize: 11, backgroundColor: '#EEF2FF', padding: '2px 4px', borderRadius: 3 }}>
                        {text}
                    </code>
                ),
                sorter: (a, b) => a.partNumber.localeCompare(b.partNumber),
            },
            {
                title: 'Material Name',
                dataIndex: 'partName',
                key: 'partName',
                width: 180,
                ellipsis: true,
                render: (text: string) => <Tooltip title={text}>{text}</Tooltip>,
            },
            {
                title: 'Supplier',
                dataIndex: 'supplier',
                key: 'supplier',
                width: 130,
                ellipsis: true,
            },
            {
                title: 'Rack',
                dataIndex: 'rackLocation',
                key: 'rackLocation',
                width: 80,
                align: 'center' as const,
                render: (text: string) => <Tag color="purple">{text || '-'}</Tag>,
            },
            {
                title: 'Qty Rack',
                dataIndex: 'qtyRack',
                key: 'qtyRack',
                width: 80,
                align: 'right' as const,
                render: (val: number) => val.toLocaleString(),
            },
            {
                title: 'Qty WH',
                dataIndex: 'qtyWarehouse',
                key: 'qtyWarehouse',
                width: 80,
                align: 'right' as const,
                render: (val: number) => val.toLocaleString(),
            },
            {
                title: 'Pending',
                dataIndex: 'qtyPending',
                key: 'qtyPending',
                width: 70,
                align: 'right' as const,
                render: (val: number | undefined) => {
                    const value = val || 0;
                    return (
                        <Tag color={value > 0 ? 'purple' : 'default'} style={{ fontSize: 10 }}>
                            {value}
                        </Tag>
                    );
                },
            },
            {
                title: 'Reserved',
                dataIndex: 'qtyReserved',
                key: 'qtyReserved',
                width: 70,
                align: 'right' as const,
                render: (val: number | undefined) => {
                    const value = val || 0;
                    return (
                        <Tag color={value > 0 ? 'orange' : 'default'} style={{ fontSize: 10 }}>
                            {value}
                        </Tag>
                    );
                },
            },
            {
                title: 'Total Avail',
                dataIndex: 'qtyCurrentTotal',
                key: 'qtyCurrentTotal',
                width: 80,
                align: 'right' as const,
                render: (val: number) => (
                    <Tag color="green" style={{ fontWeight: 600, fontSize: 11 }}>
                        {val.toLocaleString()}
                    </Tag>
                ),
            },
        ];

        // Dynamic date columns
        const dateTableColumns = dateColumns.map((d) => ({
            title: d.date,
            dataIndex: d.dateStr,
            key: d.dateStr,
            width: 90,
            align: 'center' as const,
            children: [
                {
                    title: 'Dmd',
                    dataIndex: d.dateStr,
                    key: `${d.dateStr}_demand`,
                    width: 50,
                    align: 'right' as const,
                    className: 'bg-emerald-50',
                    render: (_: any, record: MaterialMRP) => {
                        const demandData = record.dailyDemand.find(dd => dd.date === d.dateStr);
                        const demand = demandData?.demand || 0;
                        return (
                            <span style={{
                                color: demand > 0 ? '#059669' : '#6B7280',
                                fontWeight: demand > 0 ? 600 : 400,
                                fontSize: 11
                            }}>
                                {demand.toLocaleString()}
                            </span>
                        );
                    },
                },
                {
                    title: 'Lack',
                    dataIndex: d.dateStr,
                    key: `${d.dateStr}_lack`,
                    width: 50,
                    align: 'right' as const,
                    className: 'bg-red-50',
                    render: (_: any, record: MaterialMRP) => {
                        const demandData = record.dailyDemand.find(dd => dd.date === d.dateStr);
                        const lack = demandData?.lack || 0;
                        return (
                            <Tag
                                color={lack > 0 ? 'red' : 'green'}
                                style={{
                                    fontSize: 10,
                                    fontWeight: lack > 0 ? 600 : 400,
                                    margin: 0,
                                    padding: '0 4px',
                                }}
                            >
                                {lack > 0 ? lack.toLocaleString() : '✓'}
                            </Tag>
                        );
                    },
                },
            ],
        }));

        // Min Lack summary column
        const summaryColumn: TableProps<MaterialMRP>['columns'] = [
            {
                title: 'Max Lack',
                key: 'maxLack',
                width: 90,
                fixed: 'right' as const,
                align: 'right' as const,
                sorter: (a, b) => {
                    const maxA = Math.max(...a.dailyDemand.map(d => d.lack));
                    const maxB = Math.max(...b.dailyDemand.map(d => d.lack));
                    return maxB - maxA;
                },
                sortOrder: 'descend' as const,
                render: (_: any, record: MaterialMRP) => {
                    const maxLack = Math.max(...record.dailyDemand.map(d => d.lack));
                    return (
                        <Tag
                            color={maxLack > 0 ? 'red' : 'green'}
                            style={{
                                fontWeight: 700,
                                fontSize: 12,
                                minWidth: 50,
                                textAlign: 'center',
                            }}
                        >
                            {maxLack > 0 ? maxLack.toLocaleString() : 'OK'}
                        </Tag>
                    );
                },
            },
        ];

        return [...baseColumns, ...dateTableColumns, ...summaryColumn];
    };

    const columns = generateColumns();

    // Calculate scroll width based on number of dates
    const numDates = data?.dateRange
        ? Math.ceil((new Date(data.dateRange.endDate).getTime() - new Date(data.dateRange.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 7;
    const scrollX = 800 + (numDates * 90);

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'Warehouse' }, { title: 'Material Run-out' }]} />

            <ToolbarWrapper>
                <ButtonToolbar
                    title="Calculate Prediction"
                    icon={<CalculatorOutlined />}
                    onClick={handleCalculate}
                />
                <ButtonToolbar
                    title="Export Excel"
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                    enable={!!data}
                />
            </ToolbarWrapper>

            {/* Info Card */}
            {data && (
                <div style={{
                    marginBottom: 16,
                    padding: '12px 16px',
                    backgroundColor: '#EEF2FF',
                    borderRadius: 8,
                    display: 'flex',
                    gap: 24,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                }}>
                    <div>
                        <span style={{ color: '#6B7280', fontSize: 12 }}>Calculated At: </span>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{formatDateTime(data.calculatedAt)}</span>
                    </div>
                    <div>
                        <span style={{ color: '#6B7280', fontSize: 12 }}>Date Range: </span>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>
                            {formatDate(data.dateRange.startDate)} - {formatDate(data.dateRange.endDate)}
                        </span>
                    </div>
                    <div>
                        <span style={{ color: '#6B7280', fontSize: 12 }}>Total Materials: </span>
                        <span style={{ fontWeight: 600, color: '#4F46E5', fontSize: 13 }}>{data.materials.length}</span>
                    </div>
                    <div>
                        <span style={{ color: '#6B7280', fontSize: 12 }}>Need Restock: </span>
                        <span style={{ fontWeight: 600, color: '#DC2626', fontSize: 13 }}>
                            {data.materials.filter(m => Math.max(...m.dailyDemand.map(d => d.lack)) > 0).length}
                        </span>
                    </div>
                </div>
            )}

            {/* Legend */}
            {data && (
                <div style={{
                    marginBottom: 12,
                    padding: '8px 12px',
                    backgroundColor: '#F9FAFB',
                    borderRadius: 6,
                    display: 'flex',
                    gap: 16,
                    fontSize: 12,
                    alignItems: 'center',
                }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>Legend:</span>
                    <span>
                        <strong style={{ color: '#4F46E5' }}>Dmd</strong> = Demand
                    </span>
                    <span>
                        <strong style={{ color: '#DC2626' }}>Lack</strong> = Stock Shortage
                    </span>
                    <span>
                        <Tag color="green" style={{ fontSize: 10, margin: 0 }}>✓</Tag> = Stock OK
                    </span>
                    <span>
                        <Tag color="green" style={{ fontSize: 10, margin: 0 }}>OK</Tag> = No Restock Needed
                    </span>
                </div>
            )}

            {/* Main Table with Dynamic Columns */}
            <Table
                columns={columns}
                dataSource={data?.materials || []}
                size="small"
                loading={loading}
                rowKey="materialId"
                pagination={{
                    size: 'small',
                    pageSize: 50,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} materials`,
                }}
                scroll={{ x: scrollX, y: 'calc(100vh - 420px)' }}
                className="small-table"
                bordered
                locale={{
                    emptyText: (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <span>
                                    {error ? error : 'Click "Calculate MRP" to view results'}
                                </span>
                            }
                        >
                            <Button type="primary" icon={<CalculatorOutlined />} onClick={handleCalculate}>
                                Calculate Material Run-out
                            </Button>
                        </Empty>
                    ),
                }}
            />
        </Card>
    );
}
