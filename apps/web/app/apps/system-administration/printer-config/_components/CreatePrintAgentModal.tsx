/* By Irfan Akbari Vuteq Indonesia - 2026-09-28 */

"use client";

import {useEffect} from "react";
import {App, Form, Input, InputNumber, Modal} from "antd";
import {useDispatch, useSelector} from "react-redux";
import type {AppDispatch, RootState} from "@/store";
import {
    createPrintAgent,
    createPrintAgentEnrollment,
    type EnrollmentToken,
} from "@/store/features/settings/printAgentSlice";

type FormValues = {
    name: string;
    expiresInMinutes: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
    onEnrollmentCreated: (enrollment: EnrollmentToken) => void;
};

export default function CreatePrintAgentModal({open, onClose, onCreated, onEnrollmentCreated}: Props) {
    const {message} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const {createLoading, enrollmentLoading} = useSelector((state: RootState) => state.printAgent);
    const [form] = Form.useForm<FormValues>();

    useEffect(() => {
        if (open) form.setFieldsValue({name: "", expiresInMinutes: 15});
    }, [form, open]);

    const close = () => {
        if (createLoading || enrollmentLoading) return;
        form.resetFields();
        onClose();
    };

    const submit = async () => {
        try {
            const values = await form.validateFields();
            const created = await dispatch(createPrintAgent({name: values.name.trim()})).unwrap();
            const enrollment = await dispatch(createPrintAgentEnrollment({
                id: created.data.Id,
                expiresInMinutes: values.expiresInMinutes,
            })).unwrap();
            message.success("Print agent created and enrollment token generated");
            form.resetFields();
            onClose();
            onCreated();
            onEnrollmentCreated(enrollment.data);
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to create print agent");
        }
    };

    return (
        <Modal title="Create Print Agent" open={open} onCancel={close} onOk={submit} centered destroyOnHidden
               confirmLoading={createLoading || enrollmentLoading} okText="Create & Generate Token"
               mask={{closable: !createLoading && !enrollmentLoading}} closable={!createLoading && !enrollmentLoading}>
            <Form form={form} layout="vertical" style={{marginTop: 16}} initialValues={{expiresInMinutes: 15}}>
                <Form.Item name="name" label="Agent Name" rules={[
                    {required: true, whitespace: true, message: "Agent name is required"},
                    {max: 120, message: "Agent name cannot exceed 120 characters"},
                ]}>
                    <Input placeholder="Example: Production Office Agent" maxLength={120}/>
                </Form.Item>
                <Form.Item name="expiresInMinutes" label="Enrollment Token Validity" rules={[
                    {required: true, message: "Token validity is required"},
                    {type: "number", min: 1, message: "Token validity must be at least 1 minute"},
                ]}>
                    <InputNumber min={1} max={1440} addonAfter="minutes" style={{width: "100%"}}/>
                </Form.Item>
            </Form>
        </Modal>
    );
}
