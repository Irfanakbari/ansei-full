/*By Irfan Akbari Vuteq Indonesia - 2026-07-16*/
import React, {useState, useEffect} from 'react';
import {Modal, Form, Input, InputNumber, App, Select} from 'antd';
import {useDispatch, useSelector} from 'react-redux';
import {AppDispatch, RootState} from '@/store';
import {createMaterial} from '@/store/features/master/materialSlice';
import {fetchSatuan} from '@/store/features/master/satuanSlice';
import {fetchSupplier} from '@/store/features/master/supplierSlice';

interface Props {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const CreateMaterialModal: React.FC<Props> = ({visible, onClose, onSuccess}) => {
    const {message} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const {data: satuan} = useSelector((state: RootState) => state.satuan);
    const {data: suppliers} = useSelector((state: RootState) => state.supplier);

    useEffect(() => {
        if (visible) {
            dispatch(fetchSatuan());
            dispatch(fetchSupplier({page: 1, limit: 100}));
        }
    }, [visible, dispatch]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const payload = {
                partNumber: values.partNumber,
                partName: values.partName,
                supplier: values.supplier,
                satuanId: values.satuanId,
                rackLocation: values.rackLocation,
                minimumStock: values.minimumStock ?? 0,
                maximumStock: values.maximumStock ?? 0,
                qtyPerBox: values.qtyPerBox ?? 0,
            };

            const result = await dispatch(createMaterial(payload));

            if (createMaterial.rejected.match(result)) {


                throw new Error((result.payload as string) || 'Failed to create/update/delete');


            }
            message.success('Material created successfully');
            onSuccess?.();
            form.resetFields();
            onClose();
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message?.includes('validateFields')) return;
            message.error(err?.message || String(error) || 'Failed to create material');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Create New Material"
            open={visible}
            onOk={handleOk}
            centered={true}
            onCancel={() => {
                form.resetFields();
                onClose();
            }}
            confirmLoading={loading}
            destroyOnHidden
            forceRender
            width={600}
            zIndex={1050}
        >
            <Form form={form} layout="vertical">
                <Form.Item name="partNumber" label="Part Number"
                           rules={[{required: true, message: 'Please enter part number'}]}>
                    <Input placeholder="Enter part number"/>
                </Form.Item>
                <Form.Item name="partName" label="Part Name"
                           rules={[{required: true, message: 'Please enter part name'}]}>
                    <Input placeholder="Enter part name"/>
                </Form.Item>
                <Form.Item name="supplier" label="Supplier">
                    <Select
                        placeholder="Select supplier"
                        allowClear
                        showSearch={{optionFilterProp: 'label'}}
                        options={suppliers.map((supplier) => ({
                            value: supplier.Name,
                            label: supplier.Name,
                        }))}
                    />
                </Form.Item>
                <Form.Item name="satuanId" label="Unit">
                    <Select
                        placeholder="Select unit"
                        allowClear
                        showSearch={{optionFilterProp: 'label'}}
                        options={satuan.map((unit) => ({value: unit.Id, label: unit.Name}))}
                    />
                </Form.Item>
                <Form.Item name="rackLocation" label="Rack Location">
                    <Input placeholder="Enter rack location"/>
                </Form.Item>
                <Form.Item
                    name="minimumStock"
                    label="Minimum Stock"
                    initialValue={0}
                    rules={[{type: 'number', min: 0, message: 'Minimum stock cannot be negative'}]}
                >
                    <InputNumber placeholder="0" min={0} precision={0} style={{width: '100%'}}/>
                </Form.Item>
                <Form.Item
                    name="qtyPerBox"
                    label="Qty Per Box"
                    initialValue={0}
                    extra="Reference value only; this does not change inventory quantities"
                    rules={[{type: 'number', min: 0, message: 'Qty per box cannot be negative'}]}
                >
                    <InputNumber placeholder="0" min={0} precision={0} style={{width: '100%'}}/>
                </Form.Item>
                <Form.Item
                    name="maximumStock"
                    label="Maximum Stock"
                    initialValue={0}
                    extra="Use 0 when maximum stock is not configured"
                    rules={[{type: 'number', min: 0, message: 'Maximum stock cannot be negative'}]}
                >
                    <InputNumber placeholder="0" min={0} precision={0} style={{width: '100%'}}/>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default CreateMaterialModal;
