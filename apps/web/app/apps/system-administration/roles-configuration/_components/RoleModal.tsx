"use client";

import {useEffect, useRef, useState} from "react";
import {DeleteOutlined, EditOutlined, EyeOutlined} from "@ant-design/icons";
import {App, Button, Descriptions, Form, Input, Modal, Space} from "antd";
import {useDispatch} from "react-redux";
import {AppDispatch} from "@/store";
import {deleteRole, RoleData, updateRole} from "@/store/features/roles/rolesSlice";

type FormValues = {
    RoleName: string;
    Description: string;
};

type Props = {
    visible: boolean;
    data: RoleData | null;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted: () => void;
};

export default function RoleModal({visible, data, onClose, onUpdated, onDeleted}: Props) {
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
        if (visible && isEditing && data) {
            form.setFieldsValue({RoleName: data.RoleName, Description: data.Description});
        }
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
            await dispatch(updateRole({id: data.Id, roleData: values})).unwrap();
            message.success("Role updated successfully");
            form.resetFields();
            setIsEditing(false);
            onUpdated();
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to update role");
        } finally {
            saveInFlight.current = false;
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (deleteInFlight.current) return;
        modal.confirm({
            title: "Delete Role?",
            icon: <DeleteOutlined/>,
            content: `Role Name: ${data.RoleName}`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                if (deleteInFlight.current) return;
                deleteInFlight.current = true;
                setIsDeleting(true);
                try {
                    await dispatch(deleteRole(data.Id)).unwrap();
                    message.success("Role deleted successfully");
                    onDeleted();
                } catch (error: unknown) {
                    message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to delete role");
                    throw error;
                } finally {
                    deleteInFlight.current = false;
                    setIsDeleting(false);
                }
            },
        });
    };

    return (
        <Modal title={<Space>{isEditing ? <EditOutlined/> :
            <EyeOutlined/>}<span>{isEditing ? "Edit" : "Detail"} Role</span></Space>}
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
                    <Form.Item name="RoleName" label="Role Name"
                               rules={[{required: true, message: "Please enter role name"}]}>
                        <Input placeholder="Enter role name"/>
                    </Form.Item>
                    <Form.Item name="Description" label="Description">
                        <Input.TextArea placeholder="Enter description" rows={3}/>
                    </Form.Item>
                </Form>
            ) : (
                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Role Name">{data.RoleName}</Descriptions.Item>
                    <Descriptions.Item label="Description">{data.Description || "-"}</Descriptions.Item>
                    <Descriptions.Item
                        label="Permissions">{data.Permission?.map((permission) => permission.Action).join(", ") || "-"}</Descriptions.Item>
                </Descriptions>
            )}
        </Modal>
    );
}
