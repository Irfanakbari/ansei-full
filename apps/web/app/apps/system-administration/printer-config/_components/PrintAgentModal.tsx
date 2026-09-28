/* By Irfan Akbari Vuteq Indonesia - 2026-09-28 */

"use client";

import {KeyOutlined} from "@ant-design/icons";
import {Alert, App, Button, Descriptions, Form, InputNumber, Modal, Skeleton, Space, Tag} from "antd";
import {useEffect, useState} from "react";
import {useDispatch, useSelector} from "react-redux";
import type {AppDispatch, RootState} from "@/store";
import {formatDateTime} from "@/lib/utils/dateTime";
import {
    clearSelectedPrintAgent,
    createPrintAgentEnrollment,
    fetchPrintAgent,
    type EnrollmentToken,
} from "@/store/features/settings/printAgentSlice";

type Props = {
    open: boolean;
    agentId: string | null;
    onClose: () => void;
    onEnrollmentCreated: (enrollment: EnrollmentToken) => void;
};

export default function PrintAgentModal({open, agentId, onClose, onEnrollmentCreated}: Props) {
    const {message} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const {selected, detailLoading, detailError, enrollmentLoading} = useSelector((state: RootState) => state.printAgent);
    const [showEnrollmentForm, setShowEnrollmentForm] = useState(false);
    const [form] = Form.useForm<{expiresInMinutes: number}>();

    useEffect(() => {
        if (open && agentId) void dispatch(fetchPrintAgent(agentId));
        if (!open) {
            setShowEnrollmentForm(false);
            form.resetFields();
            dispatch(clearSelectedPrintAgent());
        }
    }, [agentId, dispatch, form, open]);

    const close = () => {
        if (enrollmentLoading) return;
        onClose();
    };

    const generateEnrollment = async () => {
        if (!agentId) return;
        try {
            const values = await form.validateFields();
            const response = await dispatch(createPrintAgentEnrollment({id: agentId, expiresInMinutes: values.expiresInMinutes})).unwrap();
            message.success("Enrollment token generated");
            setShowEnrollmentForm(false);
            form.resetFields();
            onEnrollmentCreated(response.data);
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to generate enrollment token");
        }
    };

    return (
        <Modal title="Print Agent Detail" open={open} onCancel={close} centered destroyOnHidden width={620}
               mask={{closable: !enrollmentLoading}} closable={!enrollmentLoading}
               footer={[
                   <Button key="close" onClick={close} disabled={enrollmentLoading}>Close</Button>,
                   <Button key="enrollment" type="primary" icon={<KeyOutlined/>}
                           onClick={() => setShowEnrollmentForm(true)} disabled={detailLoading || !selected}>
                       Generate Enrollment Token
                   </Button>,
               ]}>
            {detailLoading && <Skeleton active paragraph={{rows: 7}}/>}
            {!detailLoading && detailError && <Alert type="error" showIcon message={detailError}/>}
            {!detailLoading && selected && (
                <Space orientation="vertical" size="middle" style={{width: "100%"}}>
                    <Descriptions bordered size="small" column={1}>
                        <Descriptions.Item label="Name">{selected.Name}</Descriptions.Item>
                        <Descriptions.Item label="Connection"><Tag color={selected.displayStatus === "ONLINE" ? "green" : "default"}>{selected.displayStatus}</Tag></Descriptions.Item>
                        <Descriptions.Item label="State"><Tag color={selected.Status === "ACTIVE" ? "blue" : "red"}>{selected.Status}</Tag></Descriptions.Item>
                        <Descriptions.Item label="Version">{selected.Version || "-"}</Descriptions.Item>
                        <Descriptions.Item label="Profiles">{selected.ProfilesCount ?? 0}</Descriptions.Item>
                        <Descriptions.Item label="Last Heartbeat">{selected.LastHeartbeatAt ? formatDateTime(selected.LastHeartbeatAt) : "Never"}</Descriptions.Item>
                        <Descriptions.Item label="Created">{formatDateTime(selected.CreatedAt)}</Descriptions.Item>
                        <Descriptions.Item label="Created By">{selected.CreatedBy || "-"}</Descriptions.Item>
                        <Descriptions.Item label="Updated">{formatDateTime(selected.UpdatedAt)}</Descriptions.Item>
                        <Descriptions.Item label="Updated By">{selected.UpdatedBy || "-"}</Descriptions.Item>
                    </Descriptions>
                    {showEnrollmentForm && (
                        <Form form={form} layout="inline" initialValues={{expiresInMinutes: 15}}>
                            <Form.Item name="expiresInMinutes" label="Valid for" rules={[
                                {required: true, message: "Validity is required"},
                                {type: "number", min: 1, message: "Minimum 1 minute"},
                            ]}>
                                <InputNumber min={1} max={1440} addonAfter="minutes"/>
                            </Form.Item>
                            <Form.Item>
                                <Button type="primary" onClick={generateEnrollment} loading={enrollmentLoading}>Generate</Button>
                            </Form.Item>
                            <Form.Item>
                                <Button onClick={() => setShowEnrollmentForm(false)} disabled={enrollmentLoading}>Cancel</Button>
                            </Form.Item>
                        </Form>
                    )}
                </Space>
            )}
        </Modal>
    );
}
