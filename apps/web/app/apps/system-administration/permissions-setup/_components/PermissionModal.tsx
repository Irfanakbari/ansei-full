"use client";

import {useEffect, useRef, useState} from "react";
import {DeleteOutlined, EditOutlined, EyeOutlined} from "@ant-design/icons";
import {App, Button, Descriptions, Form, Input, Modal, Space} from "antd";
import {useDispatch} from "react-redux";
import {AppDispatch} from "@/store";
import {deletePermission, PermissionData, updatePermission} from "@/store/features/permissions/permissionsSlice";
import {formatDateTime} from "@/lib/utils/dateTime";

type FormValues = { Action: string; Description?: string };
type Props = {
    visible: boolean;
    data: PermissionData | null;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted: () => void
};

export default function PermissionModal({visible, data, onClose, onUpdated, onDeleted}: Props) {
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
        if (visible && isEditing && data) form.setFieldsValue({
            Action: data.Action,
            Description: data.Description ?? undefined
        });
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
            await dispatch(updatePermission({id: data.Id, permissionData: values})).unwrap();
            message.success("Permission updated successfully");
            form.resetFields();
            setIsEditing(false);
            onUpdated();
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to update permission");
        } finally {
            saveInFlight.current = false;
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (deleteInFlight.current) return;
        modal.confirm({
            title: "Delete Permission?",
            icon: <DeleteOutlined/>,
            content: `Action: ${data.Action}`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                if (deleteInFlight.current) return;
                deleteInFlight.current = true;
                setIsDeleting(true);
                try {
                    await dispatch(deletePermission(data.Id)).unwrap();
                    message.success("Permission deleted successfully");
                    onDeleted();
                } catch (error: unknown) {
                    message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to delete permission");
                    throw error;
                } finally {
                    deleteInFlight.current = false;
                    setIsDeleting(false);
                }
            }
        });
    };

    return <Modal title={<Space>{isEditing ? <EditOutlined/> :
        <EyeOutlined/>}<span>{isEditing ? "Edit" : "Detail"} Permission</span></Space>}
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
            <Form.Item name="Action" label="Action"
                       rules={[{required: true, message: "Please enter permission action"}]}><Input/></Form.Item>
            <Form.Item name="Description" label="Description"><Input.TextArea rows={3}/></Form.Item>
        </Form> : <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Action">{data.Action}</Descriptions.Item>
            <Descriptions.Item label="Description">{data.Description || "-"}</Descriptions.Item>
            <Descriptions.Item label="Created Date">{formatDateTime(data.CreatedAt)}</Descriptions.Item>
            <Descriptions.Item label="Created By">{data.CreatedByName || data.CreatedBy || "-"}</Descriptions.Item>
            <Descriptions.Item label="Updated Date">{formatDateTime(data.UpdatedAt)}</Descriptions.Item>
            <Descriptions.Item label="Updated By">{data.UpdatedByName || data.UpdatedBy || "-"}</Descriptions.Item>
        </Descriptions>}
    </Modal>;
}
