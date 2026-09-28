/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
"use client";

import React, {useState, useEffect} from 'react';
import {Modal, Form, Input, App} from 'antd';
import {createPrinterSetting} from '@/store/features/settings/printerSettingSlice';
import {AppDispatch} from '@/store';
import {useDispatch} from 'react-redux';
import {isValidPrinterAddress} from './printerAddressValidation';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface FormValues {
    name: string;
    ipAddress: string;
}

const CreatePrinterSettingModal: React.FC<Props> = ({visible, onClose, onSuccess}) => {
    const {message} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<FormValues>();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            form.resetFields();
        }
    }, [visible, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            await dispatch(createPrinterSetting(values)).unwrap();
            message.success('Printer setting created successfully');
            form.resetFields();
            onClose();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) {
                setLoading(false);
                return;
            }
            message.error(err?.message || String(error) || 'Failed to create printer setting');
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title="Create Printer Setting"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={handleCancel}
            confirmLoading={loading}
            mask={{closable: !loading}}
            closable={!loading}
            width={400}
            okText="Save"
            cancelText="Cancel"
            zIndex={1050}
        >
            <Form form={form} layout="vertical" style={{marginTop: 16}}>
                <Form.Item
                    name="name"
                    label="Printer Name"
                    rules={[{required: true, message: 'Printer name is required'}]}
                >
                    <Input placeholder="Example: Warehouse Printer 1"/>
                </Form.Item>

                <Form.Item
                    name="ipAddress"
                    label="Printer Address"
                    extra="Use a hostname or IP address with an optional port, for example printer-01:5000."
                    rules={[
                        {required: true, whitespace: true, message: 'Printer address is required'},
                        {validator: isValidPrinterAddress},
                    ]}
                >
                    <Input placeholder="Example: printer-01:5000"/>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreatePrinterSettingModal;
