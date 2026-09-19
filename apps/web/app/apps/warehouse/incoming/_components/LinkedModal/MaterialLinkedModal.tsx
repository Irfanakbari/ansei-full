/* By Irfan Akbari Vuteq Indonesia - 2026-09-17 */
"use client";

import { useEffect, useState } from 'react';
import type { TableProps } from 'antd';
import { Alert, Modal, Table } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { fetchMaterialByPartNumber, type MaterialEntity } from '@/store/features/master/materialSlice';
import { formatDateTime } from '@/lib/utils/dateTime';

interface MaterialLinkedModalProps {
    open: boolean;
    partNumber: string | null;
    onClose: () => void;
}

const columns: TableProps<MaterialEntity>['columns'] = [
    { title: 'Part Number', dataIndex: 'PartNumber', key: 'PartNumber', render: (value: string) => <code style={{ fontSize: 11 }}>{value || '-'}</code> },
    { title: 'Part Name', dataIndex: 'PartName', key: 'PartName', render: (value: string) => value || '-' },
    { title: 'Supplier', dataIndex: 'Supplier', key: 'Supplier', render: (value: string | null) => value || '-' },
    { title: 'Unit', key: 'SatuanData', render: (_value, record) => record.SatuanData?.Name || '-' },
    { title: 'Rack Location', dataIndex: 'RackLocation', key: 'RackLocation', render: (value: string | null) => value || '-' },
    { title: 'Qty Rack', dataIndex: 'QtyRack', key: 'QtyRack', align: 'right' },
    { title: 'Qty Warehouse', dataIndex: 'QtyWarehouse', key: 'QtyWarehouse', align: 'right' },
    { title: 'Minimum Stock', dataIndex: 'MinimumStock', key: 'MinimumStock', align: 'right' },
    { title: 'Maximum Stock', dataIndex: 'MaximumStock', key: 'MaximumStock', align: 'right', render: (value: number) => value === 0 ? 'Not Set' : value },
    { title: 'Created By', dataIndex: 'CreatedBy', key: 'CreatedBy', render: (_value, record) => record.CreatedByName || record.CreatedBy || '-' },
    { title: 'Created Date', dataIndex: 'CreatedAt', key: 'CreatedAt', render: (value: string) => formatDateTime(value) },
];

export default function MaterialLinkedModal({ open, partNumber, onClose }: MaterialLinkedModalProps) {
    const dispatch = useDispatch<AppDispatch>();
    const [material, setMaterial] = useState<MaterialEntity | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !partNumber) {
            setMaterial(null);
            setError(null);
            return;
        }

        let active = true;
        setLoading(true);
        setError(null);
        setMaterial(null);

        dispatch(fetchMaterialByPartNumber(partNumber))
            .unwrap()
            .then((response) => {
                if (active) setMaterial(response.data);
            })
            .catch((reason: unknown) => {
                if (active) setError(typeof reason === 'string' ? reason : 'Failed to fetch material detail');
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [dispatch, open, partNumber]);

    return (
        <Modal
            title={<span><ArrowRightOutlined style={{ color: '#d4a106', marginRight: 8 }} />Material Detail{partNumber ? ` - ${partNumber}` : ''}</span>}
            open={open}
            onCancel={onClose}
            footer={null}
            centered
            width={1300}
            destroyOnHidden
            zIndex={1100}
        >
            {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 12 }} />}
            <Table<MaterialEntity>
                columns={columns}
                dataSource={material ? [material] : []}
                rowKey="Id"
                pagination={false}
                loading={loading}
                size="small"
                locale={{ emptyText: error ? 'Material detail could not be loaded' : 'Material data is not available' }}
                scroll={{ x: 'max-content' }}
                className="small-table"
                style={{ fontSize: 11 }}
            />
        </Modal>
    );
}
