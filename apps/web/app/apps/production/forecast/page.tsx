/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Breadcrumb, App, Input, Button, Space, Tag, Tooltip } from 'antd';
import type { InputRef } from 'antd';
import { ReloadOutlined, EyeOutlined, SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, PrinterOutlined } from '@ant-design/icons';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store';
import { ForecastEntity, fetchForecast, deleteForecast, clearDetail, printForecastTag, setForecastQuery } from '@/store/features/production/forecast/forecastSlice';
import DetailForecastModal from './_components/DetailForecastModal';
import CreateForecastModal from './_components/CreateForecastModal';
import EditForecastModal from './_components/EditForecastModal';
import ImportForecastModal from './_components/ImportForecastModal';
import { formatDateTime } from '@/lib/utils/dateTime';

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'warning',
    RELEASED: 'processing',
    COMPLETED: 'success',
    CANCELLED: 'error',
};

export default function ForecastPage() {
    const { message, modal } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const { data, loading, query, pagination } = useSelector((state: RootState) => state.forecast);

    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isImportModalVisible, setIsImportModalVisible] = useState(false);
    const [detailData, setDetailData] = useState<ForecastEntity | null>(null);
    const [editData, setEditData] = useState<ForecastEntity | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [sortedInfo, setSortedInfo] = useState<any>({});

    const searchInput = useRef<InputRef>(null);

    useEffect(() => {
        dispatch(fetchForecast(query));
    }, [dispatch, query]);

    const selectedRecord = data.find((item) => item.Id === selectedRowKeys[0]);

    const handleViewDetail = () => {
        if (selectedRecord) {
            setDetailData(selectedRecord);
            setIsDetailModalVisible(true);
        }
    };

    const handleCloseDetailModal = () => {
        setIsDetailModalVisible(false);
        setDetailData(null);
        dispatch(clearDetail());
    };

    const handleEdit = () => {
        if (selectedRecord) {
            setEditData(selectedRecord);
            setIsEditModalVisible(true);
        }
    };

    const handleCloseEditModal = () => {
        setIsEditModalVisible(false);
        setEditData(null);
    };

    const handleDelete = () => {
        if (selectedRecord) {
            modal.confirm({
                title: 'Delete Forecast?',
                icon: <DeleteOutlined />,
                content: `Delete forecast ${selectedRecord.PoId}?`,
                okText: 'Delete',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                    try {
                        const result = await dispatch(deleteForecast(selectedRecord.Id));

                        if (deleteForecast.rejected.match(result)) {
                            throw new Error((result.payload as string) || 'Failed to delete forecast');
                        }
                        message.success('Forecast deleted successfully');
                        setSelectedRowKeys([]);
                        dispatch(fetchForecast(query));
                    } catch (error: unknown) {
                        const err = error as Error;
                        message.error(err?.message || String(error) || 'Failed to delete forecast');
                    }
                },
            });
        }
    };

    const handlePrintTag = async () => {
        if (selectedRecord) {
            try {
                setIsPrinting(true);
                const result = await dispatch(printForecastTag(selectedRecord.PoId));
                
                if (printForecastTag.rejected.match(result)) {
                    throw new Error((result.payload as string) || 'Failed to print tag');
                }
                
                message.success(result.payload.message || 'Print job emitted successfully');
            } catch (error: unknown) {
                const err = error as Error;
                message.error(err?.message || String(error) || 'Failed to print tag');
            } finally {
                setIsPrinting(false);
            }
        }
    };

    const handleTableChange = (tablePagination: any, filters: any, sorter: any) => {
        setSortedInfo(sorter);
        const search = Object.values(filters).flat().find((value) => typeof value === 'string') as string | undefined;
        dispatch(setForecastQuery({ page: tablePagination.current, limit: tablePagination.pageSize, search }));
    };

    const getColumnSearchProps = (dataIndex: string) => ({
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
            <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
                <Input
                    ref={searchInput as any}
                    placeholder={`Search ${dataIndex}`}
                    value={selectedKeys[0]}
                    onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                    onPressEnter={() => confirm()}
                    style={{ marginBottom: 8, display: 'block' }}
                />
                <Space>
                    <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{ width: 90 }}>
                        Search
                    </Button>
                    <Button onClick={() => { if (clearFilters) clearFilters(); confirm(); }} size="small" style={{ width: 90 }}>
                        Reset
                    </Button>
                </Space>
            </div>
        ),
        filterIcon: (filtered: boolean) => (
            <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />
        ),
        onFilter: (value: any, record: any) => {
            return record[dataIndex]?.toString().toLowerCase().includes((value as string).toLowerCase());
        },
    });

    const columns = [
        {
            title: 'PO ID',
            dataIndex: 'PoId',
            key: 'PoId',
            width: 150,
            ellipsis: true,
            render: (val: string) => <Tooltip title={val}><code style={{ fontSize: 11 }}>{val}</code></Tooltip>,
            ...getColumnSearchProps('PoId'),
        },
        {
            title: 'Finish Good',
            dataIndex: ['PartData', 'PartNumber'],
            key: 'PartData',
            width: 150,
            render: (_: any, record: ForecastEntity) => (
                <Tooltip title={`${record.PartData?.PartNumber} - ${record.PartData?.PartName}`}>
                    <span>{record.PartData?.PartNumber}</span>
                </Tooltip>
            ),
            ...getColumnSearchProps('PartData.PartNumber'),
        },
        {
            title: 'Vendor',
            dataIndex: 'VendorName',
            key: 'VendorName',
            width: 150,
            ellipsis: true,
            ...getColumnSearchProps('VendorName'),
        },
        {
            title: 'Qty',
            dataIndex: 'Qty',
            key: 'Qty',
            width: 80,
            align: 'right' as const,
            sorter: (a: ForecastEntity, b: ForecastEntity) => a.Qty - b.Qty,
            sortOrder: sortedInfo.columnKey === 'Qty' ? sortedInfo.order : null,
        },
        {
            title: 'Delivery Date',
            dataIndex: 'DeliveryDate',
            key: 'DeliveryDate',
            width: 120,
            render: formatDateTime,
            sorter: (a: ForecastEntity, b: ForecastEntity) => new Date(a.DeliveryDate).getTime() - new Date(b.DeliveryDate).getTime(),
            sortOrder: sortedInfo.columnKey === 'DeliveryDate' ? sortedInfo.order : null,
        },
        {
            title: 'Status',
            key: 'Status',
            width: 100,
            render: (_: any, record: ForecastEntity) => {
                const status = record.ProductionReleaseId ? 'RELEASED' : 'DRAFT';
                return (
                    <Tag color={STATUS_COLORS[status] || 'default'}>{status}</Tag>
                );
            },
        },
    ];

    return (
        <Card variant="borderless" styles={{ body: { padding: 0 } }}>
            <Breadcrumb style={{ marginBottom: 16 }} items={[{ title: 'Home' }, { title: 'Production' }, { title: 'Forecast' }]} />
            <ToolbarWrapper>
                <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => dispatch(fetchForecast(query))} />
                <ButtonToolbar title="Create" icon={<PlusOutlined />} onClick={() => setIsCreateModalVisible(true)} />
                <ButtonToolbar title="Import" icon={<UploadOutlined />} onClick={() => setIsImportModalVisible(true)} />
                <ButtonToolbar title="Detail" icon={<EyeOutlined />} onClick={handleViewDetail} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Print" icon={<PrinterOutlined />} onClick={handlePrintTag} loading={isPrinting} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Edit" icon={<EditOutlined />} onClick={handleEdit} enable={selectedRowKeys.length === 1} />
                <ButtonToolbar title="Delete" icon={<DeleteOutlined />} onClick={handleDelete} enable={selectedRowKeys.length === 1} />
            </ToolbarWrapper>

            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys),
                    checkStrictly: true,
                    type: 'radio',
                }}
                columns={columns}
                dataSource={data}
                size="small"
                loading={loading}
                onChange={handleTableChange}
                pagination={{
                    size: 'small',
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.totalItems,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} records`,
                }}
                rowKey="Id"
                scroll={{ y: 'calc(100vh - 360px)' }}
                className="small-table"
                style={{ fontSize: '11px' }}
            />

            {detailData && (
                <DetailForecastModal
                    visible={isDetailModalVisible}
                    onClose={handleCloseDetailModal}
                    data={detailData}
                />
            )}

            <CreateForecastModal
                visible={isCreateModalVisible}
                onClose={() => setIsCreateModalVisible(false)}
                onSuccess={() => dispatch(fetchForecast(query))}
            />

            {editData && (
                <EditForecastModal
                    visible={isEditModalVisible}
                    onClose={handleCloseEditModal}
                    data={editData}
                    onSuccess={() => dispatch(fetchForecast(query))}
                />
            )}

            <ImportForecastModal
                visible={isImportModalVisible}
                onClose={() => setIsImportModalVisible(false)}
                onSuccess={() => dispatch(fetchForecast(query))}
            />
        </Card>
    );
}