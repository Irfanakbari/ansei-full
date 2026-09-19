/* By Irfan Akbari Vuteq Indonesia - 2026-09-17 */
"use client";

import { useEffect, useState } from 'react';
import type { TableProps } from 'antd';
import { Alert, Modal, Table } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { fetchFinishGoodByPartNumber, type FinishGoodEntity } from '@/store/features/master/finishGoodSlice';
import { formatDateTime } from '@/lib/utils/dateTime';

interface FinishGoodLinkedModalProps {
    open: boolean;
    partNumber: string | null;
    onClose: () => void;
}

const columns: TableProps<FinishGoodEntity>['columns'] = [
    {
        title: 'Part Number',
        dataIndex: 'PartNumber',
        key: 'PartNumber',
        render: (value: string) => <code style={{ fontSize: 11 }}>{value || '-'}</code>,
    },
    {
        title: 'Part Name',
        dataIndex: 'PartName',
        key: 'PartName',
        render: (value: string) => value || '-',
    },
    {
        title: 'Alias',
        dataIndex: 'Alias',
        key: 'Alias',
        render: (value: string | null) => value || '-',
    },
    {
        title: 'Price',
        dataIndex: 'Price',
        key: 'Price',
        align: 'right',
        render: (value: number | null) => value !== null ? `Rp ${value.toLocaleString('id-ID')}` : '-',
    },
    {
        title: 'Qty',
        dataIndex: 'Qty',
        key: 'Qty',
        align: 'right',
    },
    {
        title: 'Created By',
        dataIndex: 'CreatedBy',
        key: 'CreatedBy',
        render: (_value: string, record) => record.CreatedByName || record.CreatedBy || '-',
    },
    {
        title: 'Created Date',
        dataIndex: 'CreatedAt',
        key: 'CreatedAt',
        render: (value: string) => formatDateTime(value),
    },
];

export default function FinishGoodLinkedModal({ open, partNumber, onClose }: FinishGoodLinkedModalProps) {
    const dispatch = useDispatch<AppDispatch>();
    const [finishGood, setFinishGood] = useState<FinishGoodEntity | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !partNumber) {
            setFinishGood(null);
            setError(null);
            return;
        }

        let active = true;
        setLoading(true);
        setError(null);
        setFinishGood(null);

        dispatch(fetchFinishGoodByPartNumber(partNumber))
            .unwrap()
            .then((response) => {
                if (active) setFinishGood(response.data);
            })
            .catch((reason: unknown) => {
                if (active) setError(typeof reason === 'string' ? reason : 'Failed to fetch finish good detail');
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
            title={
                <span>
                    <ArrowRightOutlined style={{ color: '#d4a106', marginRight: 8 }} />
                    Finish Good Detail{partNumber ? ` - ${partNumber}` : ''}
                </span>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            centered
            width={1100}
            destroyOnHidden
        >
            {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 12 }} />}
            <Table<FinishGoodEntity>
                columns={columns}
                dataSource={finishGood ? [finishGood] : []}
                rowKey="Id"
                pagination={false}
                loading={loading}
                size="small"
                locale={{ emptyText: error ? 'Finish Good detail could not be loaded' : 'Finish Good data is not available' }}
                scroll={{ x: 'max-content' }}
                className="small-table"
                style={{ fontSize: 11 }}
            />
        </Modal>
    );
}
