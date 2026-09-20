/* By Irfan Akbari Vuteq Indonesia - 2026-09-20 */
'use client';

import {useEffect, useRef, useState} from 'react';
import {Alert, App, Checkbox, Form, Input, Modal, Select, Typography} from 'antd';
import {useDispatch} from 'react-redux';
import {usePhasePermission} from '@/components/traceability/usePhasePermission';
import type {AppDispatch} from '@/store';
import type {SystemLogEvent} from '@/store/features/system-log/systemLogSlice';
import {
    fetchIntegrations,
    recoverIntegration,
    type IntegrationEvent,
    type RecoveryInput
} from '@/store/features/system-log/integrationThunks';
import ActionAuditPanel from './ActionAuditPanel';

interface IntegrationEventModalsProps {
    auditEvent?: SystemLogEvent;
    recoveryEvent?: SystemLogEvent;
    onCloseAudit: () => void;
    onCloseRecovery: () => void;
    onRecovered: () => void;
}

export default function IntegrationEventModals({
                                                   auditEvent,
                                                   recoveryEvent,
                                                   onCloseAudit,
                                                   onCloseRecovery,
                                                   onRecovered
                                               }: IntegrationEventModalsProps) {
    const dispatch = useDispatch<AppDispatch>();
    const {message} = App.useApp();
    const {can} = usePhasePermission();
    const [detail, setDetail] = useState<IntegrationEvent>();
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string>();
    const [saving, setSaving] = useState(false);
    const inFlight = useRef(false);
    const [form] = Form.useForm<Omit<RecoveryInput, 'requestId' | 'expectedAttempts'>>();
    const canRecover = can('IPCS.INTEGRATION_RECOVER');

    useEffect(() => {
        if (!recoveryEvent?.referenceId || !canRecover) {
            setDetail(undefined);
            setDetailError(undefined);
            return;
        }
        let active = true;
        setDetailLoading(true);
        setDetailError(undefined);
        dispatch(fetchIntegrations({page: 1, limit: 100, referenceId: recoveryEvent.referenceId}))
            .unwrap()
            .then(result => {
                if (active) setDetail(result.data.find(item => item.id === recoveryEvent.id));
            })
            .catch((failure: unknown) => {
                if (active) setDetailError(String(failure));
            })
            .finally(() => {
                if (active) setDetailLoading(false);
            });
        return () => {
            active = false;
        };
    }, [canRecover, dispatch, recoveryEvent]);

    async function submit() {
        if (!detail || !canRecover || inFlight.current) return;
        inFlight.current = true;
        try {
            const values = await form.validateFields();
            setSaving(true);
            await dispatch(recoverIntegration({id: detail.id, ...values, expectedAttempts: detail.attempts})).unwrap();
            message.success('Recovery action recorded.');
            onCloseRecovery();
            onRecovered();
        } catch (failure: unknown) {
            if (!(failure && typeof failure === 'object' && 'errorFields' in failure)) message.error(String(failure));
        } finally {
            inFlight.current = false;
            setSaving(false);
        }
    }

    return (
        <>
            <Modal centered open={!!auditEvent} onCancel={onCloseAudit} title="Integration audit history" width={1050}
                   footer={null} destroyOnHidden>
                {auditEvent && <ActionAuditPanel sourceId={auditEvent.id}/>}
            </Modal>
            <Modal centered open={!!recoveryEvent} title="Recover integration" onCancel={() => {
                if (!saving) onCloseRecovery();
            }} onOk={submit} okButtonProps={{disabled: !detail}} confirmLoading={saving || detailLoading}
                   cancelButtonProps={{disabled: saving}} destroyOnHidden>
                {detailError && <Alert type="error" showIcon title={detailError} style={{marginBottom: 16}}/>}
                {!detailLoading && !detailError && recoveryEvent && !detail &&
                    <Alert type="warning" showIcon title="Recovery detail is unavailable for this event."
                           style={{marginBottom: 16}}/>}
                <Typography.Paragraph>Retry permits one additional attempt. Check external delivery evidence and stop
                    any old worker before retrying an uncertain result. Do not enter credentials or document
                    contents.</Typography.Paragraph>
                <Typography.Paragraph copyable>{recoveryEvent?.id}</Typography.Paragraph>
                <Form form={form} layout="vertical" initialValues={{action: 'RETRY', outcomeReconciled: false}}>
                    <Form.Item name="action" label="Action" rules={[{required: true}]}><Select
                        options={[{value: 'RETRY', label: 'Retry delivery'}, {
                            value: 'CONFIRM_DELIVERED',
                            label: 'Confirm delivered from external evidence'
                        }, {value: 'CLOSE', label: 'Close without further delivery'}]}/></Form.Item>
                    <Form.Item name="reason" label="Reason / evidence reference"
                               rules={[{required: true, whitespace: true, max: 500}]}><Input.TextArea maxLength={500}
                                                                                                      rows={3}/></Form.Item>
                    <Form.Item name="outcomeReconciled" valuePropName="checked"><Checkbox>External outcome checked and
                        old worker stopped</Checkbox></Form.Item>
                </Form>
            </Modal>
        </>
    );
}
