/*By Irfan Akbari Vuteq Indonesia - 2026-06-08*/
"use client";

import React from 'react';
import { Modal, Descriptions, Tag, Typography, Space, Badge, Table, Tooltip } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface DetailSystemLogModalProps {
    visible: boolean;
    onClose: () => void;
    detail: any;
    loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    SUCCESS: 'success',
    COMPLETED: 'success',
    FAILED: 'error',
    ERROR: 'error',
    RUNNING: 'processing',
    PENDING: 'warning',
};

const formatDT = (val: string | null | undefined) => {
    if (!val) return '-';
    return new Date(val).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

const { Text } = Typography;

const DetailSystemLogModal: React.FC<DetailSystemLogModalProps> = ({
    visible,
    onClose,
    detail,
    loading,
}) => {
    const detailColumns: ColumnsType<any> = [
        {
            title: 'Message ID',
            dataIndex: 'messageId',
            key: 'messageId',
            width: 80,
            ellipsis: true,
            render: (val: string) => (
                <Tooltip title={val}>
                    <Text code style={{ fontSize: 11 }}>{val}</Text>
                </Tooltip>
            ),
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            width: 70,
            render: (val: string) => {
                const color = val === 'ERROR' || val === 'FAILED' ? 'red' : val === 'INFO' ? 'blue' : 'default';
                return <Tag color={color}>{val}</Tag>;
            },
        },
        {
            title: 'Location',
            dataIndex: 'location',
            key: 'location',
            width: 320,
            ellipsis: true,
        },
        {
            title: 'Message',
            dataIndex: 'message',
            key: 'message',
            ellipsis: true,
        },
        {
            title: 'Process Date',
            dataIndex: 'processDate',
            key: 'processDate',
            width: 150,
            render: formatDT,
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined />
                    <span>System Log Detail</span>
                    {detail && (
                        <Badge
                            status={(STATUS_COLORS[detail.processStatus] as any) || 'default'}
                            text={detail.processStatus}
                        />
                    )}
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={null}
            centered={true}
            width={1200}
            destroyOnHidden
            zIndex={1050}
        >
            {detail && (
                <>
                    <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="Process ID">
                            <Text code copyable>{detail.processId}</Text>
                        </Descriptions.Item>
                        <Descriptions.Item label="Function ID">
                            {detail.functionId}
                        </Descriptions.Item>
                        <Descriptions.Item label="Function Name">
                            {detail.functionName}
                        </Descriptions.Item>
                        <Descriptions.Item label="Status">
                            <Badge
                                status={(STATUS_COLORS[detail.processStatus] as any) || 'default'}
                                text={detail.processStatus}
                            />
                        </Descriptions.Item>
                        <Descriptions.Item label="Process Date">
                            {formatDT(detail.processDate)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Created At">
                            {formatDT(detail.createdAt)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Process Start">
                            {formatDT(detail.processStart)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Process End">
                            {formatDT(detail.processEnd)}
                        </Descriptions.Item>
                    </Descriptions>

                    <Typography.Title level={5} style={{ marginBottom: 8 }}>
                        Detail Messages ({detail.details?.length ?? 0})
                    </Typography.Title>
                    <Table
                        columns={detailColumns}
                        dataSource={detail.details ?? []}
                        size="small"
                        loading={loading}
                        rowKey="id"
                        pagination={false}
                        scroll={{ x: 900, y: 340 }}
                        className="small-table"
                        style={{ fontSize: '11px' }}
                    />
                </>
            )}
            {loading && !detail && (
                <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
            )}
        </Modal>
    );
};

export default DetailSystemLogModal;