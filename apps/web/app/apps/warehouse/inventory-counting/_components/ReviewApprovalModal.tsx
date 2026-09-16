/* By Irfan Akbari Vuteq Indonesia - 2026-09-16 */
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal,
    Table,
    Tag,
    Button,
    Space,
    Input,
    Checkbox,
    Alert,
    Descriptions,
    Statistic,
    Card,
    Row,
    Col,
    Segmented,
    App,
} from 'antd';
import {
    CheckCircleOutlined,
    WarningOutlined,
    CheckOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import {
    closeInventoryCounting,
    fetchInventoryCountingDetails,
    InventoryCountingEntity,
    InventoryCountingDetailEntity,
} from '@/store/features/warehouse/inventoryCounting/inventoryCountingSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: InventoryCountingEntity | null;
    onSuccess?: () => void;
}

const ReviewApprovalModal: React.FC<Props> = ({
    visible,
    onClose,
    data,
    onSuccess,
}) => {
    const { message: antMessage } = App.useApp();
    const dispatch = useDispatch<AppDispatch>();

    const [details, setDetails] = useState<InventoryCountingDetailEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmedCheck, setConfirmedCheck] = useState(false);
    const [notes, setNotes] = useState('');
    const [viewMode, setViewMode] = useState<string>('diff_only');

    // Fetch fresh details when modal opens
    useEffect(() => {
        if (visible && data?.Id) {
            setConfirmedCheck(false);
            setNotes('');
            setViewMode('diff_only');
            const loadData = async () => {
                try {
                    setLoading(true);
                    const result = await dispatch(fetchInventoryCountingDetails(data.Id));
                    if (fetchInventoryCountingDetails.fulfilled.match(result)) {
                        const list = Array.isArray(result.payload)
                            ? result.payload
                            : (result.payload as any)?.data || [];
                        setDetails(list);
                    }
                } catch {
                    antMessage.error('Failed to load inventory counting details');
                } finally {
                    setLoading(false);
                }
            };
            loadData();
        }
    }, [visible, data?.Id, dispatch, antMessage]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = details.length;
        let completed = 0;
        let discrepancies = 0;
        let surplus = 0;
        let loss = 0;
        let match = 0;

        details.forEach((d) => {
            const hasActual = d.ActualQty !== null && d.ActualQty !== undefined;
            if (hasActual) {
                completed++;
                const diff = (d.ActualQty ?? 0) - (d.SystemQty ?? 0);
                if (diff > 0) {
                    discrepancies++;
                    surplus++;
                } else if (diff < 0) {
                    discrepancies++;
                    loss++;
                } else {
                    match++;
                }
            }
        });

        return {
            total,
            completed,
            incomplete: total - completed,
            discrepancies,
            surplus,
            loss,
            match,
        };
    }, [details]);

    // Filter table data
    const filteredData = useMemo(() => {
        if (viewMode === 'diff_only') {
            return details.filter((d) => {
                const diff = (d.ActualQty ?? 0) - (d.SystemQty ?? 0);
                return diff !== 0 || d.ActualQty === null;
            });
        }
        return details;
    }, [details, viewMode]);

    const handleApprove = async () => {
        if (!data?.Id) return;

        if (!confirmedCheck) {
            antMessage.warning(
                'You must review and check the confirmation box before proceeding.',
            );
            return;
        }

        if (stats.incomplete > 0) {
            antMessage.error(
                `There are still ${stats.incomplete} uncounted items. Cannot approve.`,
            );
            return;
        }

        try {
            setSubmitting(true);
            const result = await dispatch(
                closeInventoryCounting({
                    id: data.Id,
                    confirmedCheck: true,
                    notes: notes.trim() || undefined,
                }),
            );

            if (closeInventoryCounting.fulfilled.match(result)) {
                antMessage.success(
                    'Approval successful: Inventory Counting approved and system stock updated.',
                );
                onClose();
                if (onSuccess) onSuccess();
            } else {
                throw new Error(
                    (result.payload as string) || 'Failed to approve inventory counting',
                );
            }
        } catch (error: unknown) {
            const err = error as Error;
            antMessage.error(err?.message || 'Failed to approve inventory counting');
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        {
            title: 'Part Number',
            dataIndex: 'MaterialId',
            key: 'PartNumber',
            width: 150,
            render: (_: any, record: InventoryCountingDetailEntity) => (
                <div>
                    <code style={{ fontSize: 12 }}>
                        {record.MaterialId || record.FinishGoodId || '-'}
                    </code>
                    {record.MaterialData?.PartName && (
                        <div style={{ fontSize: 11, color: '#888' }}>
                            {record.MaterialData.PartName}
                        </div>
                    )}
                    {record.FGData?.PartName && (
                        <div style={{ fontSize: 11, color: '#888' }}>
                            {record.FGData.PartName}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Location',
            dataIndex: 'Location',
            key: 'Location',
            width: 100,
            render: (loc: string) => (
                <Tag color={loc === 'WAREHOUSE' ? 'blue' : loc === 'RACK' ? 'green' : 'purple'}>
                    {loc}
                </Tag>
            ),
        },
        {
            title: 'System Qty',
            dataIndex: 'SystemQty',
            key: 'SystemQty',
            width: 95,
            align: 'right' as const,
            render: (val: number) => <strong>{val ?? 0}</strong>,
        },
        {
            title: 'Actual Qty',
            dataIndex: 'ActualQty',
            key: 'ActualQty',
            width: 95,
            align: 'right' as const,
            render: (val: number | null) => {
                if (val === null || val === undefined) {
                    return <Tag color="error">Not Counted</Tag>;
                }
                return <strong>{val}</strong>;
            },
        },
        {
            title: 'Difference (Diff)',
            key: 'Diff',
            width: 110,
            align: 'center' as const,
            render: (_: any, record: InventoryCountingDetailEntity) => {
                if (record.ActualQty === null || record.ActualQty === undefined) {
                    return <Tag color="default">-</Tag>;
                }
                const diff = record.ActualQty - record.SystemQty;
                if (diff === 0) {
                    return <Tag color="default">Match (0)</Tag>;
                }
                if (diff > 0) {
                    return <Tag color="success">+{diff} (Surplus)</Tag>;
                }
                return <Tag color="error">{diff} (Loss)</Tag>;
            },
        },
        {
            title: 'Notes',
            dataIndex: 'Notes',
            key: 'Notes',
            ellipsis: true,
            render: (text: string | null) => text || '-',
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <CheckCircleOutlined style={{ color: '#1677ff' }} />
                    <span>Review & Inventory Counting Approval: {data?.OpnameNumber || '-'}</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            centered
            width={900}
            zIndex={1060}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#888' }}>
                        * Requires special permission <code>IPCS.INVENTORY_COUNTING_APPROVE</code>
                    </div>
                    <Space>
                        <Button onClick={onClose} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            icon={<CheckOutlined />}
                            loading={submitting}
                            disabled={!confirmedCheck || stats.incomplete > 0 || stats.total === 0}
                            onClick={handleApprove}
                        >
                            Approve & Close Session (Adjust Stock)
                        </Button>
                    </Space>
                </div>
            }
        >
            <Descriptions size="small" column={3} style={{ marginBottom: 16 }}>
                <Descriptions.Item label="Opname Number">
                    <code>{data?.OpnameNumber || '-'}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                    <Tag color={data?.Category === 'MATERIAL' ? 'blue' : 'purple'}>
                        {data?.Category}
                    </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color="processing">{data?.Status || '-'}</Tag>
                </Descriptions.Item>
            </Descriptions>

            <Row gutter={12} style={{ marginBottom: 16 }}>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Total Items"
                            value={stats.total}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Completed Counting"
                            value={stats.completed}
                            suffix={`/ ${stats.total}`}
                            styles={{
                                content: {
                                    color: stats.incomplete === 0 ? '#3f8600' : '#cf1322',
                                },
                            }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Match Items (0 Diff)"
                            value={stats.match}
                            styles={{ content: { color: '#1677ff' } }}
                        />
                    </Card>
                </Col>
                <Col span={6}>
                    <Card size="small">
                        <Statistic
                            title="Discrepancy Items"
                            value={stats.discrepancies}
                            prefix={stats.discrepancies > 0 ? <WarningOutlined /> : <CheckCircleOutlined />}
                            styles={{
                                content: {
                                    color: stats.discrepancies > 0 ? '#d46b08' : '#3f8600',
                                },
                            }}
                        />
                    </Card>
                </Col>
            </Row>

            {stats.incomplete > 0 && (
                <Alert
                    type="error"
                    showIcon
                    icon={<CloseCircleOutlined />}
                    title="Counting Incomplete"
                    description={`There are ${stats.incomplete} items that have not been physically counted. All items must be counted before the approver can review and close the session.`}
                    style={{ marginBottom: 16 }}
                />
            )}

            {stats.discrepancies > 0 && stats.incomplete === 0 && (
                <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                    title="Attention: Stock Discrepancies Detected"
                    description={`Discrepancies found across ${stats.discrepancies} items (${stats.surplus} surplus, ${stats.loss} loss). Approving this session will create Inventory Ledger adjustment entries and update master stock to actual quantities.`}
                    style={{ marginBottom: 16 }}
                />
            )}

            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Segmented
                    options={[
                        { label: `Discrepancies Only (${stats.discrepancies})`, value: 'diff_only' },
                        { label: `All Items (${stats.total})`, value: 'all' },
                    ]}
                    value={viewMode}
                    onChange={(val) => setViewMode(val as string)}
                    size="small"
                />
                <span style={{ fontSize: 12, color: '#888' }}>
                    Showing {filteredData.length} items
                </span>
            </div>

            <Table
                columns={columns}
                dataSource={filteredData}
                rowKey="Id"
                size="small"
                loading={loading}
                pagination={{ pageSize: 10, size: 'small' }}
                scroll={{ y: 260 }}
                style={{ marginBottom: 16 }}
            />

            <Card size="small" style={{ background: '#fafafa' }}>
                <div style={{ marginBottom: 8 }}>
                    <Checkbox
                        checked={confirmedCheck}
                        onChange={(e) => setConfirmedCheck(e.target.checked)}
                        disabled={stats.incomplete > 0}
                    >
                        <strong style={{ color: '#1677ff' }}>
                            I have inspected and confirmed all physical counting results and stock discrepancies above.
                        </strong>
                    </Checkbox>
                </div>
                <Input.TextArea
                    placeholder="Approval / verification notes (optional, e.g. Verified with warehouse audit team)"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={submitting}
                />
            </Card>
        </Modal>
    );
};

export default ReviewApprovalModal;
