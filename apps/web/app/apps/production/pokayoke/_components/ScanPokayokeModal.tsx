/*By Irfan Akbari Vuteq Indonesia - 2026-06-09*/
"use client";

import React, {useEffect, useRef, useState} from 'react';
import {Alert, Modal, Form, Select, Button, Space, App} from 'antd';
import {ScanOutlined} from '@ant-design/icons';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {
    fetchPokayokeScanOptions,
    scanPokayoke,
    type PokayokeScanOption,
    type PokayokeScanRequest,
} from '@/store/features/production/pokayoke/pokayokeSlice';

interface ScanPokayokeModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ScanPokayokeModal: React.FC<ScanPokayokeModalProps> = ({
                                                                 visible,
                                                                 onClose,
                                                                 onSuccess,
                                                             }) => {
    const {message: antMessage} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const {scanning} = useSelector((state: RootState) => state.pokayoke);
    const [form] = Form.useForm<PokayokeScanRequest>();
    const [options, setOptions] = useState<PokayokeScanOption[]>([]);
    const [search, setSearch] = useState('');
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [optionsError, setOptionsError] = useState<string | null>(null);
    const pending = useRef(false);

    useEffect(() => {
        if (!visible) return;
        let current = true;
        const timer = setTimeout(() => {
            setLoadingOptions(true);
            dispatch(fetchPokayokeScanOptions(search || undefined))
                .unwrap()
                .then((data) => {
                    if (!current) return;
                    setOptions(data.labels);
                    setOptionsError(null);
                })
                .catch((error: unknown) => {
                    if (!current) return;
                    setOptions([]);
                    setOptionsError(String(error));
                })
                .finally(() => {
                    if (current) setLoadingOptions(false);
                });
        }, 250);
        return () => {
            current = false;
            clearTimeout(timer);
        };
    }, [dispatch, search, visible]);

    const handleFinish = async (values: PokayokeScanRequest) => {
        if (pending.current) return;
        pending.current = true;
        try {
            await dispatch(scanPokayoke(values)).unwrap();
            resetAndClose();
            onSuccess();
        } catch (error: unknown) {
            antMessage.error(String(error || 'Scan failed'));
        } finally {
            pending.current = false;
        }
    };

    const resetAndClose = () => {
        form.resetFields();
        setSearch('');
        setOptions([]);
        setOptionsError(null);
        onClose();
    };

    const handleCancel = () => {
        if (!pending.current) resetAndClose();
    };

    return (
        <Modal
            title="Scan Pokayoke"
            open={visible}
            onCancel={handleCancel}
            footer={null}
            centered
            zIndex={1050}
        >
            {optionsError && <Alert type="error" title={optionsError} showIcon className="mb-4"/>}
            <Form
                form={form}
                layout="vertical"
                onFinish={handleFinish}
                initialValues={{status: 'SUKSES'}}
            >
                <Form.Item
                    name="labelNumber"
                    label="Label Number"
                    rules={[{required: true, message: 'Please select label number'}]}
                >
                    <Select
                        showSearch={{
                            filterOption: false,
                            onSearch: (value) => {
                                form.setFieldValue('labelNumber', undefined);
                                setOptions([]);
                                setSearch(value);
                            },
                        }}
                        allowClear
                        loading={loadingOptions}
                        disabled={scanning}
                        placeholder="Select or search label number"
                        size="large"
                        notFoundContent={loadingOptions ? 'Loading labels...' : 'No eligible labels found'}
                        options={options.map((option) => ({
                            value: option.labelNumber,
                            label: `${option.labelNumber} · ${option.finishGoodId} · ${option.finishGoodName} · ${option.qtyThisBox} pcs · ${option.requiresAssembly ? 'Assembly required' : 'No assembly required'}`,
                        }))}
                    />
                </Form.Item>

                <Form.Item
                    name="status"
                    label="Status"
                    rules={[{required: true, message: 'Please select status'}]}
                >
                    <Select
                        size="large"
                        disabled={scanning}
                        options={[
                            {value: 'SUKSES', label: 'SUKSES'},
                            {value: 'GAGAL', label: 'GAGAL'},
                        ]}
                    />
                </Form.Item>

                <Form.Item style={{marginBottom: 0, textAlign: 'right'}}>
                    <Space>
                        <Button onClick={handleCancel} disabled={scanning}>
                            Cancel
                        </Button>
                        <Button type="primary" htmlType="submit" loading={scanning}
                                disabled={loadingOptions || Boolean(optionsError)} icon={<ScanOutlined/>}>
                            Scan
                        </Button>
                    </Space>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default ScanPokayokeModal;
