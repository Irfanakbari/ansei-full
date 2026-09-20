"use client";

import {useEffect, useRef, useState} from "react";
import {DeleteOutlined, EditOutlined, EyeOutlined} from "@ant-design/icons";
import {App, Button, Descriptions, Form, Input, Modal, Select, Space, Tag} from "antd";
import {useDispatch} from "react-redux";
import {AppDispatch} from "@/store";
import {
    deleteEmailNotification,
    EmailNotificationEntity,
    NotificationType,
    updateEmailNotification
} from "@/store/features/settings/emailNotificationSlice";
import {formatDateTime} from "@/lib/utils/dateTime";

type FormValues = {
    name: string;
    email: string;
    type: NotificationType;
};

type Props = {
    visible: boolean;
    data: EmailNotificationEntity | null;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted: () => void;
};

const typeOptions: { value: NotificationType; label: string }[] = [
    {value: "DEFAULT", label: "Default"},
    {value: "INCOMING", label: "Incoming"},
    {value: "OUTGOING", label: "Outgoing"},
    {value: "PRODUCTION", label: "Production"},
    {value: "TRANSFER", label: "Transfer"},
];

export default function EmailNotificationModal({visible, data, onClose, onUpdated, onDeleted}: Props) {
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
        if (visible && isEditing && data) form.setFieldsValue({name: data.Name, email: data.Email, type: data.Type});
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
            await dispatch(updateEmailNotification({id: data.Id, data: values})).unwrap();
            message.success("Email notification updated successfully");
            form.resetFields();
            setIsEditing(false);
            onUpdated();
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to update email notification");
        } finally {
            saveInFlight.current = false;
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (deleteInFlight.current) return;
        modal.confirm({
            title: "Delete Email Notification?",
            icon: <DeleteOutlined/>,
            content: `Delete email notification for "${data.Name}" (${data.Email})?`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                if (deleteInFlight.current) return;
                deleteInFlight.current = true;
                setIsDeleting(true);
                try {
                    await dispatch(deleteEmailNotification(data.Id)).unwrap();
                    message.success("Email notification deleted successfully");
                    onDeleted();
                } catch (error: unknown) {
                    message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to delete email notification");
                    throw error;
                } finally {
                    deleteInFlight.current = false;
                    setIsDeleting(false);
                }
            },
        });
    };

    return (
        <Modal title={<Space>{isEditing ? <EditOutlined/> : <EyeOutlined/>}<span>{isEditing ? "Edit" : "Detail"} Email Notification</span></Space>}
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
            {isEditing ? (
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="Recipient Name"
                               rules={[{required: true, message: "Recipient name is required"}]}>
                        <Input placeholder="Example: John Doe"/>
                    </Form.Item>
                    <Form.Item name="email" label="Email" rules={[{required: true, message: "Email is required"}, {
                        type: "email",
                        message: "Invalid email format"
                    }]}>
                        <Input placeholder="Example: john@company.com"/>
                    </Form.Item>
                    <Form.Item name="type" label="Notification Type"
                               rules={[{required: true, message: "Notification type is required"}]}>
                        <Select options={typeOptions} placeholder="Select notification type"/>
                    </Form.Item>
                </Form>
            ) : (
                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Recipient Name">{data.Name}</Descriptions.Item>
                    <Descriptions.Item label="Email">{data.Email}</Descriptions.Item>
                    <Descriptions.Item label="Notification Type"><Tag>{data.Type}</Tag></Descriptions.Item>
                    <Descriptions.Item label="Created Date">{formatDateTime(data.CreatedAt)}</Descriptions.Item>
                    <Descriptions.Item
                        label="Created By">{data.CreatedByName || data.CreatedBy || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Updated Date">{formatDateTime(data.UpdatedAt)}</Descriptions.Item>
                    <Descriptions.Item
                        label="Updated By">{data.UpdatedByName || data.UpdatedBy || "-"}</Descriptions.Item>
                </Descriptions>
            )}
        </Modal>
    );
}
