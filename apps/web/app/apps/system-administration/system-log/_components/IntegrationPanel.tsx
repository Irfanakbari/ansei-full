/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
'use client';
import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Checkbox, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import { usePhasePermission } from '@/components/traceability/usePhasePermission';
import type { AppDispatch } from '@/store';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import ButtonToolbar from '@/components/ButtonToolbar';
import { formatDateTime } from '@/lib/utils/dateTime';
import { fetchIntegrations, fetchIntegrationSummary, recoverIntegration, type IntegrationEvent, type IntegrationQuery, type IntegrationSummary, type RecoveryInput } from '@/store/features/system-log/integrationThunks';
import ActionAuditPanel from './ActionAuditPanel';

export default function IntegrationPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const { can } = usePhasePermission();
  const canRecover = can('IPCS.INTEGRATION_RECOVER');
  const [query, setQuery] = useState<IntegrationQuery>({ page: 1, limit: 20 });
  const [rows, setRows] = useState<IntegrationEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<IntegrationSummary>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<IntegrationEvent>();
  const [auditId, setAuditId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const [form] = Form.useForm<Omit<RecoveryInput, 'requestId' | 'expectedAttempts'>>();
  useEffect(() => {
    let active = true;
    setLoading(true); setError(undefined);
    Promise.all([dispatch(fetchIntegrations(query)).unwrap(), dispatch(fetchIntegrationSummary()).unwrap()]).then(([result, summary]) => {
      if (active) { setRows(result.data); setTotal(result.meta.totalItems); setSummary(summary); }
    }).catch((failure: unknown) => { if (active) { setError(String(failure)); setRows([]); setSummary(undefined); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [dispatch, query]);
  const columns: TableProps<IntegrationEvent>['columns'] = [
    { title: 'Created (Jakarta)', dataIndex: 'createdAt', render: formatDateTime },
    { title: 'Type', dataIndex: 'type' },
    { title: 'Reference', dataIndex: 'referenceId', ellipsis: true },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={value === 'FAILED' ? 'error' : value === 'SUCCEEDED' ? 'success' : 'processing'}>{value}</Tag> },
    { title: 'Attempts', render: (_, row) => `${row.attempts}/${row.maxAttempts}` },
    { title: 'Result / attention', render: (_, row) => row.completionEvidence === 'LEGACY_UNVERIFIED' ? 'Legacy completion — transport outcome not verified.' : row.error?.message || (row.status === 'SUCCEEDED' ? 'Transport accepted; physical print / recipient receipt not verified.' : 'Awaiting transport result') },
    { title: 'Actions', render: (_, row) => <Space><Button type="link" size="small" onClick={() => setAuditId(row.id)}>Audit</Button>{canRecover && row.status === 'FAILED' && row.error?.code !== 'OUTBOX_CLOSED' && <Button size="small" onClick={() => { form.resetFields(); setSelected(row); }}>Recover</Button>}</Space> },
  ];
  async function submit() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    try {
      const values = await form.validateFields(); setSaving(true);
      await dispatch(recoverIntegration({ id: selected.id, ...values, expectedAttempts: selected.attempts })).unwrap();
      message.success('Recovery action recorded.'); setSelected(undefined); setQuery(current => ({ ...current }));
    } catch (failure: unknown) {
      if (!(failure && typeof failure === 'object' && 'errorFields' in failure)) message.error(String(failure));
    } finally { inFlight.current = false; setSaving(false); }
  }
  return <>
    <ToolbarWrapper><ButtonToolbar title="Refresh" icon={<ReloadOutlined />} onClick={() => setQuery(current => ({ ...current }))} /><ButtonToolbar title="Reset Filter" onClick={() => setQuery({ page: 1, limit: 20 })} />
      <Select aria-label="Integration status" allowClear placeholder="All statuses" value={query.status} style={{ width: 155 }} options={['PENDING','QUEUED','PROCESSING','SUCCEEDED','FAILED'].map(value => ({value,label:value}))} onChange={status => setQuery(current => ({ ...current, status, page: 1 }))} />
      <Select aria-label="Integration type" allowClear placeholder="All integrations" value={query.type} style={{ width: 220 }} options={['PRINT_PART_TAG_ANSEI','DELIVERY_NOTE_EMAIL'].map(value => ({value,label:value}))} onChange={type => setQuery(current => ({ ...current, type, page: 1 }))} />
      <Input placeholder="Document reference" aria-label="Document reference" value={query.referenceId || ''} allowClear style={{ width: 220 }} onChange={event => setQuery(current => ({ ...current, referenceId: event.target.value || undefined, page: 1 }))} />
    </ToolbarWrapper>
    {error && <Alert type="error" title={error} showIcon />}
    {summary && <Space wrap style={{ marginBottom: 12 }}><Tag>Pending {summary.pending}</Tag><Tag>Queued {summary.queued}</Tag><Tag>Processing {summary.processing}</Tag><Tag color="error">Failed {summary.failed}</Tag><Tag color="warning">Uncertain {summary.uncertain}</Tag><Tag>Exhausted {summary.exhausted}</Tag><Typography.Text type="secondary">Oldest open: {summary.oldestPendingAt ? formatDateTime(summary.oldestPendingAt) : '—'} · Updated {formatDateTime(summary.observedAt)}</Typography.Text></Space>}
    {summary && (!summary.queueAvailable || !summary.printerQueueAvailable) && <Alert type="warning" title="Queue unavailable. Durable requests are retained; investigate the dependency before recovery." showIcon />}
    <Table<IntegrationEvent> rowKey="id" size="small" className="small-table" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 'max-content' }} pagination={{ current: query.page, pageSize: query.limit, total, showSizeChanger: true, onChange: (page, limit) => setQuery(current => ({ ...current, page, limit })) }} />
    <Modal centered open={!!selected} title="Recover integration" onCancel={() => { if (!saving) setSelected(undefined); }} onOk={submit} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} destroyOnHidden>
      <Typography.Paragraph>Retry permits one additional attempt. Check external delivery evidence and stop any old worker before retrying an uncertain result. Do not enter credentials or document contents.</Typography.Paragraph>
      <Typography.Paragraph copyable>{selected?.id}</Typography.Paragraph>
      <Form form={form} layout="vertical" initialValues={{ action: 'RETRY', outcomeReconciled: false }}>
        <Form.Item name="action" label="Action" rules={[{ required: true }]}><Select options={[{ value: 'RETRY', label: 'Retry delivery' }, { value: 'CONFIRM_DELIVERED', label: 'Confirm delivered from external evidence' }, { value: 'CLOSE', label: 'Close without further delivery' }]} /></Form.Item>
        <Form.Item name="reason" label="Reason / evidence reference" rules={[{ required: true, whitespace: true, max: 500 }]}><Input.TextArea maxLength={500} rows={3} /></Form.Item>
        <Form.Item name="outcomeReconciled" valuePropName="checked"><Checkbox>External outcome checked and old worker stopped</Checkbox></Form.Item>
      </Form>
    </Modal>
    <Modal centered open={!!auditId} onCancel={() => setAuditId(undefined)} title="Integration audit history" width={1050} footer={null} destroyOnHidden>{auditId && <ActionAuditPanel sourceId={auditId} />}</Modal>
  </>;
}
