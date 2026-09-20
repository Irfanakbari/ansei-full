/* By Irfan Akbari Vuteq Indonesia - 2026-09-20 */
'use client';

import {useEffect, useState} from 'react';
import {Alert, Descriptions, Modal, Table, Typography} from 'antd';
import {useDispatch} from 'react-redux';
import type {AppDispatch} from '@/store';
import {fetchActionAudit, type ActionAuditEvent, type SystemLogEvent} from '@/store/features/system-log/systemLogSlice';

interface ActionDetailModalProps {
    event?: SystemLogEvent;
    onClose: () => void;
}

export default function ActionDetailModal({event, onClose}: ActionDetailModalProps) {
    const dispatch = useDispatch<AppDispatch>();
    const [detail, setDetail] = useState<ActionAuditEvent>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        if (!event) {
            setDetail(undefined);
            setError(undefined);
            return;
        }
        let active = true;
        setLoading(true);
        setError(undefined);
        dispatch(fetchActionAudit({page: 1, limit: 100, sourceId: event.referenceId || undefined}))
            .unwrap()
            .then(result => {
                if (active) setDetail(result.data.find(item => item.Id === event.id));
            })
            .catch((failure: unknown) => {
                if (active) setError(String(failure));
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [dispatch, event]);

    const fields = Array.from(new Set([
        ...Object.keys(detail?.Before ?? {}),
        ...Object.keys(detail?.After ?? {}),
    ]));

    return (
        <Modal centered open={!!event} onCancel={onClose} footer={null} title="Action Audit Detail" width={950}
               loading={loading} destroyOnHidden>
            {error && <Alert type="error" showIcon title={error}/>}
            {event && detail && (
                <>
                    <Descriptions bordered size="small" column={2} items={[
                        {
                            key: 'id',
                            label: 'Event ID',
                            children: <Typography.Text copyable>{detail.Id}</Typography.Text>
                        },
                        {key: 'action', label: 'Action', children: detail.Action},
                        {key: 'actor', label: 'Actor', children: detail.Actor || 'Unattributed'},
                        {key: 'source', label: 'Attribution', children: detail.ActorSource},
                        {key: 'request', label: 'Request ID', children: detail.RequestId || 'Unavailable'},
                        {key: 'process', label: 'Process ID', children: detail.ProcessId || 'Unavailable'},
                        {key: 'document', label: detail.SourceType, children: detail.SourceId, span: 2},
                    ]}/>
                    <Table
                        size="small"
                        rowKey="field"
                        pagination={false}
                        style={{marginTop: 16}}
                        dataSource={fields.map(field => ({
                            field,
                            before: detail.Before?.[field],
                            after: detail.After?.[field]
                        }))}
                        columns={[
                            {title: 'Field', dataIndex: 'field'},
                            {
                                title: 'Before',
                                dataIndex: 'before',
                                render: value => value === undefined ? '—' : JSON.stringify(value)
                            },
                            {
                                title: 'After',
                                dataIndex: 'after',
                                render: value => value === undefined ? '—' : JSON.stringify(value)
                            },
                        ]}
                    />
                    <Typography.Paragraph type="secondary" style={{marginTop: 16}}>
                        Only selected operational fields are recorded. Historical actions before this audit was enabled
                        are not reconstructed.
                    </Typography.Paragraph>
                </>
            )}
            {!loading && !error && event && !detail &&
                <Alert type="warning" showIcon title="Action detail is unavailable."/>}
        </Modal>
    );
}
