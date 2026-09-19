"use client";

import {useEffect, useRef, useState} from "react";
import {DeleteOutlined, EditOutlined, EyeOutlined} from "@ant-design/icons";
import {App, Button, Descriptions, Form, Input, Modal, Select, Space, Switch, Tag} from "antd";
import {useDispatch, useSelector} from "react-redux";
import {AppDispatch, RootState} from "@/store";
import {deleteUser, updateUser, UserManagementEntity} from "@/store/features/users/usersSlice";
import {fetchRoles} from "@/store/features/roles/rolesSlice";

type FormValues = {
    Name: string;
    Email: string;
    PhoneNumber?: string;
    IsActive: boolean;
    RoleId?: number;
};

type Props = {
    visible: boolean;
    data: UserManagementEntity | null;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted: () => void;
};

export default function UserModal({visible, data, onClose, onUpdated, onDeleted}: Props) {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<FormValues>();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const saveInFlight = useRef(false);
    const deleteInFlight = useRef(false);
    const {data: roles, loading: rolesLoading} = useSelector((state: RootState) => state.roles);

    useEffect(() => {
        if (!visible) {
            setIsEditing(false);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible || !isEditing || !data) return;
        form.setFieldsValue({
            Name: data.Name,
            Email: data.Email,
            PhoneNumber: data.PhoneNumber ?? undefined,
            IsActive: data.IsActive,
            RoleId: data.RoleId ?? undefined,
        });
        void dispatch(fetchRoles());
    }, [data, dispatch, form, isEditing, visible]);

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
            await dispatch(updateUser({
                id: data.UserId,
                userData: {
                    Name: values.Name,
                    Email: values.Email,
                    PhoneNumber: values.PhoneNumber,
                    IsActive: values.IsActive,
                    RoleId: values.RoleId,
                },
            })).unwrap();
            message.success("User updated successfully");
            form.resetFields();
            setIsEditing(false);
            onUpdated();
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to update user");
        } finally {
            saveInFlight.current = false;
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (deleteInFlight.current) return;
        modal.confirm({
            title: "Delete User?",
            icon: <DeleteOutlined/>,
            content: `User: ${data.Name}`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                if (deleteInFlight.current) return;
                deleteInFlight.current = true;
                setIsDeleting(true);
                try {
                    await dispatch(deleteUser(data.UserId)).unwrap();
                    message.success("User deleted successfully");
                    onDeleted();
                } catch (error: unknown) {
                    message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to delete user");
                    throw error;
                } finally {
                    deleteInFlight.current = false;
                    setIsDeleting(false);
                }
            },
        });
    };

    return <Modal title={<Space>{isEditing ? <EditOutlined/> :
        <EyeOutlined/>}<span>{isEditing ? "Edit" : "Detail"} User</span></Space>}
                  open={visible} onCancel={handleClose} centered width={600} destroyOnHidden zIndex={1050}
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
            <Form.Item name="Name" label="Name" rules={[{required: true}]}><Input/></Form.Item>
            <Form.Item name="Email" label="Email" rules={[{required: true, type: "email"}]}><Input/></Form.Item>
            <Form.Item name="PhoneNumber" label="Phone Number"><Input/></Form.Item>
            <Form.Item name="RoleId" label="Role"><Select allowClear loading={rolesLoading}
                                                          showSearch={{optionFilterProp: "label"}}
                                                          options={roles.map((role) => ({
                                                              value: role.Id,
                                                              label: role.RoleName
                                                          }))}/></Form.Item>
            <Form.Item name="IsActive" label="Account Active" valuePropName="checked"><Switch/></Form.Item>
        </Form> : <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="User ID">{data.UserId}</Descriptions.Item>
            <Descriptions.Item label="Name">{data.Name}</Descriptions.Item>
            <Descriptions.Item label="Email">{data.Email}</Descriptions.Item>
            <Descriptions.Item label="Phone Number">{data.PhoneNumber || "-"}</Descriptions.Item>
            <Descriptions.Item label="Role">{data.Role?.RoleName || "-"}</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag
                color={data.IsActive ? "green" : "red"}>{data.IsActive ? "Active" : "Inactive"}</Tag></Descriptions.Item>
        </Descriptions>}
    </Modal>;
}
