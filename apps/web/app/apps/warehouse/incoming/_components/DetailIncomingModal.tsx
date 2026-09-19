/* By Irfan Akbari Vuteq Indonesia - 2026-06-08 */
"use client";

import React, {useRef, useState} from 'react';
import {App, Button, Modal, Descriptions, Table, Tooltip, Typography, Space} from 'antd';
import {DeleteOutlined, EyeOutlined} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import {IncomingEntity, IncomingMaterial} from '@/store/features/warehouse/incoming/incomingSlice';
import MaterialLinkedModal from './LinkedModal/MaterialLinkedModal';
import GoldenArrowAction from '@/components/GoldenArrowAction';
import {useDispatch} from 'react-redux';
import {AppDispatch} from '@/store';
import {deleteIncoming} from '@/store/features/warehouse/incoming/incomingSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    data: IncomingEntity;
    onDeleted: () => void;
}

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

const DetailIncomingModal: React.FC<Props> = ({visible, onClose, data, onDeleted}) => {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [linkedPartNumber, setLinkedPartNumber] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const deleteInFlight = useRef(false);

    const remove = () => modal.confirm({
        title: 'Delete Incoming?',
        icon: <DeleteOutlined/>,
        content: `Delete incoming for PO ${data.PoId}?`,
        okText: 'Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        centered: true,
        onOk: async () => {
            if (deleteInFlight.current) return;
            deleteInFlight.current = true;
            setDeleting(true);
            try {
                await dispatch(deleteIncoming(data.Id)).unwrap();
                message.success('Incoming deleted successfully');
                onDeleted();
            } catch (error: unknown) {
                message.error(typeof error === 'string' ? error : error instanceof Error ? error.message : 'Failed to delete incoming');
                throw error;
            } finally {
                deleteInFlight.current = false;
                setDeleting(false);
            }
        },
    });

    const columns: ColumnsType<IncomingMaterial> = [
        {
            title: '#',
            key: 'index',
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Part Number',
            dataIndex: ['MaterialData', 'PartNumber'],
            key: 'PartNumber',
            render: (val: string) => (
                <Space size={4}>
                    <GoldenArrowAction tooltip="View Material details" ariaLabel={`View Material details for ${val}`}
                                       onClick={() => setLinkedPartNumber(val)}/>
                    <Tooltip title={val}><code style={{fontSize: 11}}>{val}</code></Tooltip>
                </Space>
            ),
        },
        {
            title: 'Part Name',
            dataIndex: ['MaterialData', 'PartName'],
            key: 'PartName',
        },
        {
            title: 'Qty',
            dataIndex: 'Qty',
            key: 'Qty',
            align: 'right' as const,
        },
        {
            title: 'Qty Checked',
            dataIndex: 'QtyChecked',
            key: 'QtyChecked',
            align: 'right' as const,
            render: (value: number | null | undefined) => value ?? '-',
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <EyeOutlined/>
                    <span>Incoming Detail - PO {data.PoId}</span>
                </Space>
            }
            open={visible}
            onCancel={() => {
                if (!deleting) onClose();
            }}
            footer={!data.Closed ?
                <Button danger icon={<DeleteOutlined/>} onClick={remove} loading={deleting}>Delete</Button> : null}
            centered={true}
            width={900}
            destroyOnHidden
            zIndex={1050}
            closable={!deleting}
            mask={{closable: !deleting}}
        >
            <Descriptions bordered size="small" column={2} style={{marginBottom: 16}}>
                <Descriptions.Item label="PO Number">
                    {data.PoId}
                </Descriptions.Item>
                <Descriptions.Item label="Supplier">
                    {data.SupplierData?.Name}
                </Descriptions.Item>
                <Descriptions.Item label="Received By">
                    {data.ReceivedByName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                    {data.Closed ? 'Closed' : 'Open'}
                </Descriptions.Item>
                <Descriptions.Item label="Approved At">
                    {formatDT(data.ApprovedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Approved By">
                    {data.ApprovedByName || data.ApprovedBy || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Updated At" span={2}>
                    {formatDT(data.UpdatedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                    {data.Description || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Created At">
                    {formatDT(data.CreatedAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Created By">
                    {data.CreatedByName || '-'}
                </Descriptions.Item>
            </Descriptions>

            <Typography.Title level={5} style={{marginBottom: 8}}>
                Materials ({data.IncomingMaterial?.length ?? 0})
            </Typography.Title>
            <Table
                columns={columns}
                dataSource={data.IncomingMaterial ?? []}
                size="small"
                rowKey="Id"
                pagination={false}
                scroll={{x: 'max-content', y: 300}}
                className="small-table"
                style={{fontSize: '11px'}}
            />

            <MaterialLinkedModal
                open={linkedPartNumber !== null}
                partNumber={linkedPartNumber}
                onClose={() => setLinkedPartNumber(null)}
            />
        </Modal>
    );
};

export default DetailIncomingModal;
