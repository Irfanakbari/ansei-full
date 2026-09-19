/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import React, {useEffect, useRef, useState} from "react";
import {App, Button, Descriptions, Form, Input, InputNumber, Modal, Select, Space} from "antd";
import {DeleteOutlined, EditOutlined, EyeOutlined} from "@ant-design/icons";
import {useDispatch, useSelector} from "react-redux";
import {AppDispatch, RootState} from "@/store";
import {deleteMaterial, MaterialEntity, updateMaterial} from "@/store/features/master/materialSlice";
import {fetchSatuan} from "@/store/features/master/satuanSlice";
import {fetchSupplier} from "@/store/features/master/supplierSlice";
import {formatDateTime} from "@/lib/utils/dateTime";

type FormValues = {
    partNumber: string;
    partName: string;
    supplier?: string;
    satuanId?: number;
    rackLocation?: string;
    minimumStock?: number;
    maximumStock?: number
};
type Props = { open: boolean; data: MaterialEntity | null; onClose: () => void; onChanged: () => void };

export default function MaterialModal({open, data, onClose, onChanged}: Props) {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<FormValues>();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const saveInFlight = useRef(false);
    const deleteInFlight = useRef(false);
    const {data: satuan} = useSelector((state: RootState) => state.satuan);
    const {data: suppliers} = useSelector((state: RootState) => state.supplier);

    useEffect(() => {
        if (!open) {
            setEditing(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open || !editing || !data) return;
        form.setFieldsValue({
            partNumber: data.PartNumber,
            partName: data.PartName,
            supplier: data.Supplier ?? undefined,
            satuanId: data.SatuanId ?? undefined,
            rackLocation: data.RackLocation ?? undefined,
            minimumStock: data.MinimumStock,
            maximumStock: data.MaximumStock
        });
        void dispatch(fetchSatuan());
        void dispatch(fetchSupplier({page: 1, limit: 100}));
    }, [data, dispatch, editing, form, open]);

    if (!data) return null;

    const errorMessage = (error: unknown, fallback: string) => typeof error === "string" ? error : error instanceof Error ? error.message : fallback;
    const close = () => {
        if (saving || deleting) return;
        if (editing) {
            form.resetFields();
            setEditing(false);
        }
        onClose();
    };
    const save = async () => {
        if (saveInFlight.current) return;
        try {
            const values = await form.validateFields();
            saveInFlight.current = true;
            setSaving(true);
            await dispatch(updateMaterial({id: data.Id, data: values})).unwrap();
            message.success("Material updated successfully");
            form.resetFields();
            setEditing(false);
            onChanged();
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(errorMessage(error, "Failed to update material"));
        } finally {
            saveInFlight.current = false;
            setSaving(false);
        }
    };
    const remove = () => modal.confirm({
        title: "Delete Material?",
        icon: <DeleteOutlined/>,
        content: `Delete material ${data.PartNumber}?`,
        okText: "Delete",
        okType: "danger",
        cancelText: "Cancel",
        centered: true,
        onOk: async () => {
            if (deleteInFlight.current) return;
            deleteInFlight.current = true;
            setDeleting(true);
            try {
                await dispatch(deleteMaterial(data.Id)).unwrap();
                message.success("Material deleted successfully");
                onChanged();
                onClose();
            } catch (error: unknown) {
                message.error(errorMessage(error, "Failed to delete material"));
                throw error;
            } finally {
                deleteInFlight.current = false;
                setDeleting(false);
            }
        }
    });

    return <Modal title={<Space>{editing ? <EditOutlined/> : <EyeOutlined/>}<span>{editing ? "Edit" : "Detail"} Material - {data.PartNumber}</span></Space>}
                  open={open} onCancel={close} centered width={650} destroyOnHidden
                  mask={{closable: !saving && !deleting}}
                  closable={!saving && !deleting} footer={editing ? [<Button key="cancel" onClick={() => {
        form.resetFields();
        setEditing(false);
    }} disabled={saving}>Cancel</Button>,
        <Button key="save" type="primary" onClick={save} loading={saving}>Save</Button>] : [<Button key="delete" danger
                                                                                                    icon={
                                                                                                        <DeleteOutlined/>}
                                                                                                    onClick={remove}
                                                                                                    loading={deleting}>Delete</Button>,
        <Button key="edit" type="primary" icon={<EditOutlined/>} onClick={() => setEditing(true)}
                disabled={deleting}>Edit</Button>]}>
        {editing ? <Form form={form} layout="vertical">
            <Form.Item name="partNumber" label="Part Number"
                       rules={[{required: true, message: "Please enter part number"}]}><Input/></Form.Item>
            <Form.Item name="partName" label="Part Name"
                       rules={[{required: true, message: "Please enter part name"}]}><Input/></Form.Item>
            <Form.Item name="supplier" label="Supplier"><Select allowClear showSearch={{optionFilterProp: "label"}}
                                                                options={suppliers.map((item) => ({
                                                                    value: item.Name,
                                                                    label: item.Name
                                                                }))}/></Form.Item>
            <Form.Item name="satuanId" label="Unit"><Select allowClear showSearch={{optionFilterProp: "label"}}
                                                            options={satuan.map((item) => ({
                                                                value: item.Id,
                                                                label: item.Name
                                                            }))}/></Form.Item>
            <Form.Item name="rackLocation" label="Rack Location"><Input/></Form.Item>
            <Form.Item label="Qty Rack" extra="Stock quantity is managed through inventory transactions"><InputNumber
                value={data.QtyRack} disabled style={{width: "100%"}}/></Form.Item>
            <Form.Item label="Qty Warehouse"
                       extra="Stock quantity is managed through inventory transactions"><InputNumber
                value={data.QtyWarehouse} disabled style={{width: "100%"}}/></Form.Item>
            <Form.Item name="minimumStock" label="Minimum Stock"
                       rules={[{type: "number", min: 0, message: "Minimum stock cannot be negative"}]}><InputNumber
                min={0} precision={0} style={{width: "100%"}}/></Form.Item>
            <Form.Item name="maximumStock" label="Maximum Stock" extra="Use 0 when maximum stock is not configured"
                       rules={[{type: "number", min: 0, message: "Maximum stock cannot be negative"}]}><InputNumber
                min={0} precision={0} style={{width: "100%"}}/></Form.Item>
        </Form> : <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="Part Number">{data.PartNumber}</Descriptions.Item><Descriptions.Item
            label="Part Name">{data.PartName}</Descriptions.Item><Descriptions.Item
            label="Supplier">{data.Supplier || "-"}</Descriptions.Item><Descriptions.Item
            label="Unit">{data.SatuanData?.Name || "-"}</Descriptions.Item><Descriptions.Item
            label="Rack Location">{data.RackLocation || "-"}</Descriptions.Item><Descriptions.Item
            label="Qty Rack">{data.QtyRack}</Descriptions.Item><Descriptions.Item
            label="Qty Warehouse">{data.QtyWarehouse}</Descriptions.Item><Descriptions.Item
            label="Minimum Stock">{data.MinimumStock}</Descriptions.Item><Descriptions.Item
            label="Maximum Stock">{data.MaximumStock === 0 ? "Not Set" : data.MaximumStock}</Descriptions.Item><Descriptions.Item
            label="Created By">{data.CreatedByName || data.CreatedBy || "-"}</Descriptions.Item><Descriptions.Item
            label="Created Date">{formatDateTime(data.CreatedAt)}</Descriptions.Item><Descriptions.Item
            label="Updated Date">{formatDateTime(data.UpdatedAt)}</Descriptions.Item>
        </Descriptions>}
    </Modal>;
}
