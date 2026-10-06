/* By Irfan Akbari Vuteq Indonesia - 2026-09-21 */
"use client";

import {useEffect, useState} from "react";
import {DeleteOutlined, PlusOutlined} from "@ant-design/icons";
import {App, Button, Form, Input, InputNumber, Modal, Select, Space, Typography} from "antd";
import {useDispatch} from "react-redux";
import {AppDispatch} from "@/store";
import {
    fetchSupplierBarcodeFormat,
    supplierBarcodeFields,
    SupplierBarcodeField,
    upsertSupplierBarcodeFormat
} from "@/store/features/master/supplierSlice";

type FormValues = { delimiterPreset: string; customDelimiter?: string; fields: {value: SupplierBarcodeField; offset?: number}[] };
type Props = { open: boolean; supplierId: number; supplierName: string; onClose: () => void };

export default function SupplierBarcodeFormatModal({open, supplierId, supplierName, onClose}: Props) {
    const {message} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<FormValues>();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const preset = Form.useWatch("delimiterPreset", form);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        dispatch(fetchSupplierBarcodeFormat(supplierId)).unwrap().then((response) => {
            const format = response.data;
            const known = ["#", "-", " ", "\\t", "\\n"].includes(format?.Delimiter ?? "");
            form.setFieldsValue({
                delimiterPreset: format ? (known ? format.Delimiter : "CUSTOM") : "#",
                customDelimiter: format && !known ? format.Delimiter : undefined,
                fields: (format?.Fields ?? ["PART_NUMBER", "QUANTITY"]).map((value, index) => ({
                    value,
                    offset: format?.FieldOffsets?.[index] ?? 0
                }))
            });
        }).catch((error: unknown) => {
            message.error(typeof error === "string" ? error : "Failed to fetch supplier barcode format");
        }).finally(() => setLoading(false));
    }, [dispatch, form, message, open, supplierId]);

    const save = async () => {
        try {
            const values = await form.validateFields();
            setSaving(true);
            const delimiter = values.delimiterPreset === "CUSTOM" ? values.customDelimiter! : values.delimiterPreset;
            await dispatch(upsertSupplierBarcodeFormat({
                id: supplierId,
                data: {
                    delimiter,
                    fields: values.fields.map(({value}) => value),
                    fieldOffsets: values.fields.map(({offset}) => offset ?? 0)
                }
            })).unwrap();
            message.success("Supplier barcode format saved successfully");
            onClose();
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(typeof error === "string" ? error : "Failed to save supplier barcode format");
        } finally {
            setSaving(false);
        }
    };

    return <Modal title={`Barcode Format - ${supplierName}`} open={open} onCancel={onClose} onOk={save}
                  confirmLoading={saving} loading={loading} centered width={620} destroyOnHidden>
        <Form form={form} layout="vertical">
            <Form.Item name="delimiterPreset" label="Delimiter" rules={[{required: true}]}>
                <Select options={[{value: "#", label: "#"}, {value: "-", label: "-"}, {value: " ", label: "Space"},
                    {value: "\\t", label: "Tab (\\t)"}, {value: "\\n", label: "New line (\\n)"},
                    {value: "CUSTOM", label: "Custom"}]}/>
            </Form.Item>
            {preset === "CUSTOM" && <Form.Item name="customDelimiter" label="Custom Delimiter"
                                                rules={[{required: true}, {max: 5, message: "Use at most 5 characters"},
                                                    {pattern: /^[^\r\n\t]+$/, message: "Use escaped \\t or \\n from the delimiter list"}]}>
                <Input maxLength={5}/>
            </Form.Item>}
            <Typography.Paragraph type="secondary">Use escaped <Typography.Text code>\t</Typography.Text> for tab and <Typography.Text code>\n</Typography.Text> for a new line.</Typography.Paragraph>
            <Typography.Paragraph type="secondary">
                Use offset <Typography.Text code>0</Typography.Text> for delimiter-only formats. A larger start offset removes leading characters after the barcode is split. Example: delimiter <Typography.Text code>Space</Typography.Text>, first field <Typography.Text code>PART_NUMBER</Typography.Text>, offset <Typography.Text code>11</Typography.Text> converts <Typography.Text code>B26J02A0097B1K-B1010</Typography.Text> to <Typography.Text code>B1K-B1010</Typography.Text>.
            </Typography.Paragraph>
            <Form.List name="fields" rules={[{validator: async (_, fields: {value?: SupplierBarcodeField}[]) => {
                const values = fields.map((field) => field.value);
                if (values.filter((value) => value === "PART_NUMBER").length !== 1 || values.filter((value) => value === "QUANTITY").length !== 1) {
                    throw new Error("Include exactly one PART_NUMBER and exactly one QUANTITY");
                }
            }}]}>
                {(fields, {add, remove}, {errors}) => <Space orientation="vertical" style={{width: "100%"}}>
                    {fields.map(({key, ...field}, index) => <Space key={key} style={{display: "flex"}} align="baseline">
                        <Typography.Text>{index + 1}.</Typography.Text>
                        <Form.Item {...field} name={[field.name, "value"]} rules={[{required: true, message: "Select a field"}]}>
                            <Select style={{width: 260}} options={supplierBarcodeFields.map((value) => ({value, label: value}))}/>
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, "offset"]}
                                   rules={[{type: "integer", min: 0, max: 500, message: "Use 0 to 500"}]}>
                            <InputNumber min={0} max={500} precision={0} placeholder="Start offset" style={{width: 130}}/>
                        </Form.Item>
                        <Button danger type="text" icon={<DeleteOutlined/>} onClick={() => remove(field.name)} aria-label={`Remove field ${index + 1}`}/>
                    </Space>)}
                    <Button type="dashed" icon={<PlusOutlined/>} onClick={() => add({value: "IGNORE", offset: 0})}>Add Field</Button>
                    <Form.ErrorList errors={errors}/>
                </Space>}
            </Form.List>
        </Form>
    </Modal>;
}
