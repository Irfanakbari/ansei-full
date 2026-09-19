"use client";

import {useEffect, useRef, useState} from "react";
import {DeleteOutlined, EditOutlined, EyeOutlined} from "@ant-design/icons";
import {App, Button, Descriptions, Form, Input, Modal, Space, Tag} from "antd";
import {useDispatch} from "react-redux";
import {AppDispatch} from "@/store";
import {
    deletePrinterSetting,
    PrinterSettingEntity,
    updatePrinterSetting
} from "@/store/features/settings/printerSettingSlice";
import {formatDateTime} from "@/lib/utils/dateTime";

type FormValues = { name: string; ipAddress: string };
type Props = {
    visible: boolean;
    data: PrinterSettingEntity | null;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted: () => void
};

export default function PrinterSettingModal({visible, data, onClose, onUpdated, onDeleted}: Props) {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<FormValues>();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const saveInFlight = useRef(false);
    const deleteInFlight = useRef(false);

    useEffect(() => {
        if (!visible) {
            setIsEditing(false);
        }
    }, [visible]);
    useEffect(() => {
        if (visible && isEditing && data) form.setFieldsValue({name: data.Name ?? "", ipAddress: data.IpAddress});
    }, [data, form, isEditing, visible]);
    if (!data) return null;

    const handleClose = () => {
        if (isSaving || isDeleting) return;
        if (isEditing) {
            form.resetFields();
            setIsEditing(false);
        }
        onClose();
    };
    const handleSave = async () => {
        if (saveInFlight.current) return;
        try {
            const values = await form.validateFields();
            saveInFlight.current = true;
            setIsSaving(true);
            await dispatch(updatePrinterSetting({id: data.Id, data: values})).unwrap();
            message.success("Printer setting updated successfully");
            form.resetFields();
            setIsEditing(false);
            onUpdated();
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to update printer setting");
        } finally {
            saveInFlight.current = false;
            setIsSaving(false);
        }
    };
    const handleDelete = () => {
        if (deleteInFlight.current) return;
        modal.confirm({
            title: "Delete Printer Setting?",
            icon: <DeleteOutlined/>,
            content: `Printer: ${data.Name || data.IpAddress}`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                if (deleteInFlight.current) return;
                deleteInFlight.current = true;
                setIsDeleting(true);
                try {
                    await dispatch(deletePrinterSetting(data.Id)).unwrap();
                    message.success("Printer setting deleted successfully");
                    onDeleted();
                } catch (error: unknown) {
                    message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to delete printer setting");
                    throw error;
                } finally {
                    deleteInFlight.current = false;
                    setIsDeleting(false);
                }
            }
        });
    };

    return <Modal
        title={<Space>{isEditing ? <EditOutlined/> : <EyeOutlined/>}<span>{isEditing ? "Edit" : "Detail"} Printer Setting</span></Space>}
        open={visible} onCancel={handleClose} centered width={500} destroyOnHidden zIndex={1050}
        mask={{closable: !isSaving && !isDeleting}} closable={!isSaving && !isDeleting}
        footer={isEditing ? [
            <Button key="cancel" onClick={() => {
                form.resetFields();
                setIsEditing(false);
            }} disabled={isSaving}>Cancel</Button>,
            <Button key="save" type="primary" onClick={handleSave} loading={isSaving}
                    disabled={isDeleting}>Save</Button>,
        ] : [
            <Button key="delete" danger icon={<DeleteOutlined/>} onClick={handleDelete}
                    loading={isDeleting}>Delete</Button>,
            <Button key="edit" type="primary" icon={<EditOutlined/>} onClick={() => setIsEditing(true)}
                    disabled={isDeleting}>Edit</Button>,
        ]}>
        {isEditing ? <Form form={form} layout="vertical">
            <Form.Item name="name" label="Printer Name" rules={[{required: true, message: "Printer name is required"}]}><Input/></Form.Item>
            <Form.Item name="ipAddress" label="IP Address"
                       rules={[{required: true, message: "IP Address is required"}, {
                           pattern: /^(\d{1,3}\.){3}\d{1,3}$/,
                           message: "Invalid IP Address format"
                       }]}><Input/></Form.Item>
        </Form> : <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Printer Name">{data.Name || "-"}</Descriptions.Item>
            <Descriptions.Item label="IP Address"><Tag color="blue">{data.IpAddress}</Tag></Descriptions.Item>
            <Descriptions.Item label="Created By">{data.CreatedByName || "-"}</Descriptions.Item>
            <Descriptions.Item label="Created At">{formatDateTime(data.CreatedAt)}</Descriptions.Item>
        </Descriptions>}
    </Modal>;
}
