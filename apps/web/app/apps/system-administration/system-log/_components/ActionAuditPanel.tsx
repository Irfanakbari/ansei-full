/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { fetchActionAudit, type ActionAuditEvent, type ActionAuditQuery } from '@/store/features/system-log/systemLogSlice';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { formatDateTime } from '@/lib/utils/dateTime';

export default function ActionAuditPanel({ processId, sourceId }: { processId?: string; sourceId?: string }) {
  const dispatch = useDispatch<AppDispatch>();
  const [query, setQuery] = useState<ActionAuditQuery>({ page: 1, limit: 20 });
  const [rows, setRows] = useState<ActionAuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<ActionAuditEvent>();
  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined);
    dispatch(fetchActionAudit({ ...query, ...(processId ? { processId } : {}), ...(sourceId ? { sourceId } : {}) })).unwrap().then(result => {
      if (!active) return;
      setRows(result.data); setTotal(result.meta.totalItems);
    }).catch((failure: unknown) => {
      if (active) { setRows([]); setError(String(failure)); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dispatch, query, processId, sourceId]);
  const filter = (values: Partial<ActionAuditQuery>) => setQuery(current => ({ ...current, ...values, page: 1 }));
  const columns: TableProps<ActionAuditEvent>['columns'] = [
    { title: 'Time (Jakarta)', dataIndex: 'CreatedAt', width: 160, render: formatDateTime },
    { title: 'Action', dataIndex: 'Action', width: 110, render: value => <Tag color={value === 'DENIED' || value === 'FAILED' ? 'error' : value === 'REPLAY' ? 'warning' : 'blue'}>{value}</Tag> },
    { title: 'Document', dataIndex: 'SourceType', width: 160 },
    { title: 'Reference', dataIndex: 'SourceId', ellipsis: true },
    { title: 'Actor', dataIndex: 'Actor', width: 170, render: value => value || <Tag>Unattributed</Tag> },
    { title: 'Action', key: 'detail', width: 75, render: (_, row) => <Button size="small" type="link" onClick={() => setSelected(row)}>Detail</Button> },
  ];
  const fields = Array.from(new Set([...Object.keys(selected?.Before ?? {}), ...Object.keys(selected?.After ?? {})]));
  return <>
    <ToolbarWrapper>
      <ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => setQuery(current => ({ ...current }))} />
      <ButtonToolbar title="Reset Filter" onClick={() => setQuery({ page: 1, limit: 20 })} />
      <Space wrap>
        {!processId && <Input.Search aria-label="Process ID" placeholder="Process ID" allowClear onSearch={processId => filter({ processId: processId || undefined })} style={{ width: 210 }} />}
        <Input.Search aria-label="Request ID" placeholder="Request ID" allowClear onSearch={requestId => filter({ requestId: requestId || undefined })} style={{ width: 210 }} />
        <Input.Search disabled={!!sourceId} aria-label="Document reference" placeholder="Document reference" allowClear onSearch={sourceId => filter({ sourceId: sourceId || undefined })} style={{ width: 210 }} />
        <Select aria-label="Audit action" placeholder="All actions" allowClear value={query.action} onChange={action => filter({ action })} style={{ width: 145 }} options={['INSERT', 'UPDATE', 'DELETE', 'REPLAY', 'RETRY', 'DENIED', 'FAILED', 'CREATE', 'QUEUE', 'QUEUE_FAILED', 'PREPARE', 'PRINT_READY', 'SEND', 'SENDING', 'TRANSPORT_ACCEPTED', 'UNCERTAIN', 'INTERRUPTED', 'RECOVER', 'PREPARATION_FAILED', 'DOCUMENT_CHANGED', 'CONFIRM_DELIVERED', 'CLOSE'].map(value => ({ value, label: value }))} />
      </Space>
    </ToolbarWrapper>
    {error && <Alert type="error" showIcon title={error} />}
    <Table<ActionAuditEvent> rowKey="Id" columns={columns} dataSource={rows} loading={loading} size="small" className="small-table" scroll={{ x: 950 }} pagination={{ current: query.page, pageSize: query.limit, total, showSizeChanger: true, onChange: (page, limit) => setQuery(current => ({ ...current, page, limit })) }} />
    <Modal centered open={!!selected} onCancel={() => setSelected(undefined)} footer={null} title="Action Audit Detail" width={950} destroyOnHidden>
      {selected && <>
        <Descriptions bordered size="small" column={2} items={[
          { key: 'id', label: 'Event ID', children: <Typography.Text copyable>{selected.Id}</Typography.Text> },
          { key: 'action', label: 'Action', children: selected.Action },
          { key: 'actor', label: 'Actor', children: selected.Actor || 'Unattributed' },
          { key: 'source', label: 'Attribution', children: selected.ActorSource },
          { key: 'request', label: 'Request ID', children: selected.RequestId || 'Unavailable' },
          { key: 'process', label: 'Process ID', children: selected.ProcessId || 'Unavailable' },
          { key: 'document', label: selected.SourceType, children: selected.SourceId, span: 2 },
        ]} />
        <Table size="small" rowKey="field" pagination={false} style={{ marginTop: 16 }} dataSource={fields.map(field => ({ field, before: selected.Before?.[field], after: selected.After?.[field] }))} columns={[
          { title: 'Field', dataIndex: 'field' },
          { title: 'Before', dataIndex: 'before', render: value => value === undefined ? '—' : JSON.stringify(value) },
          { title: 'After', dataIndex: 'after', render: value => value === undefined ? '—' : JSON.stringify(value) },
        ]} />
        <Typography.Paragraph type="secondary">Only selected operational fields are recorded. A replay returns an existing transaction; it does not move stock again. Historical actions before this audit was enabled are not reconstructed.</Typography.Paragraph>
      </>}
    </Modal>
  </>;
}
