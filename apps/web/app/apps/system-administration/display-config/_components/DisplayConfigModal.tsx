"use client";

import {useEffect, useRef, useState} from "react";
import {DeleteOutlined, EditOutlined, EyeOutlined, UploadOutlined} from "@ant-design/icons";
import {App, Button, Descriptions, Form, Input, Modal, Space, Switch, Tag, Upload} from "antd";
import {useDispatch} from "react-redux";
import {AppDispatch} from "@/store";
import {
    deleteDisplayConfig,
    DisplayConfigEntity,
    UpdateDisplayConfigDto,
    updateDisplayConfig,
    uploadDisplayMedia
} from "@/store/features/settings/displayConfig/displayConfigSlice";

type FormValues = {
    description: string;
    url?: string;
    line?: string;
    isOpen: boolean;
    loop: boolean;
};

type Props = {
    visible: boolean;
    data: DisplayConfigEntity | null;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted: () => void;
};

export default function DisplayConfigModal({visible, data, onClose, onUpdated, onDeleted}: Props) {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<FormValues>();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const saveInFlight = useRef(false);
    const deleteInFlight = useRef(false);

    useEffect(() => {
        if (!visible) {
            setIsEditing(false);
            setMediaFile(null);
        }
    }, [visible]);

    useEffect(() => {
        if (visible && isEditing && data) {
            form.setFieldsValue({
                description: data.Description,
                url: data.Url ?? undefined,
                line: data.Line ?? undefined,
                isOpen: data.IsOpen,
                loop: data.Loop
            });
        }
    }, [data, form, isEditing, visible]);

    if (!data) return null;

    const cancelEdit = () => {
        form.resetFields();
        setMediaFile(null);
        setIsEditing(false);
    };

    const handleClose = () => {
        if (isSaving || isDeleting) return;
        setMediaFile(null);
        if (isEditing) cancelEdit();
        onClose();
    };

    const handleSave = async () => {
        if (saveInFlight.current) return;
        let configSaved = false;
        try {
            const values = await form.validateFields();
            saveInFlight.current = true;
            setIsSaving(true);
            const payload: UpdateDisplayConfigDto = {
                description: values.description,
                url: values.url || undefined,
                line: values.line || undefined,
                isOpen: values.isOpen,
                loop: values.loop,
            };
            await dispatch(updateDisplayConfig({id: data.Id, data: payload})).unwrap();
            configSaved = true;
            if (mediaFile) await dispatch(uploadDisplayMedia({id: data.Id, file: mediaFile})).unwrap();
            message.success("Display config updated successfully");
            cancelEdit();
            onUpdated();
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            const backendMessage = typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to update display config";
            message.error(configSaved ? `Display config updated, but media upload failed: ${backendMessage}` : backendMessage);
            if (configSaved) onUpdated();
        } finally {
            saveInFlight.current = false;
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (deleteInFlight.current) return;
        modal.confirm({
            title: "Delete Display Config?",
            icon: <DeleteOutlined/>,
            content: `Delete display config "${data.Description}"?`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                if (deleteInFlight.current) return;
                deleteInFlight.current = true;
                setIsDeleting(true);
                try {
                    await dispatch(deleteDisplayConfig(data.Id)).unwrap();
                    message.success("Display config deleted successfully");
                    onDeleted();
                } catch (error: unknown) {
                    message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to delete display config");
                    throw error;
                } finally {
                    deleteInFlight.current = false;
                    setIsDeleting(false);
                }
            },
        });
    };

    return (
        <Modal title={<Space>{isEditing ? <EditOutlined/> : <EyeOutlined/>}<span>{isEditing ? "Edit" : "Detail"} Display Config</span></Space>}
               open={visible} onCancel={handleClose} centered width={550} destroyOnHidden zIndex={1050}
               mask={{closable: !isSaving && !isDeleting}} closable={!isSaving && !isDeleting}
               footer={isEditing ? [
                   <Button key="cancel" onClick={cancelEdit} disabled={isSaving}>Cancel</Button>,
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
                    <Form.Item name="description" label="Description"
                               rules={[{required: true, message: "Description is required"}, {
                                   max: 255,
                                   message: "Description max 255 characters"
                               }]}>
                        <Input placeholder="e.g., Display Utama Gudang"/>
                    </Form.Item>
                    <Form.Item name="url" label="URL (Optional)" rules={[{type: "url", message: "Invalid URL format"}]}
                               extra="Uploaded media has priority over this URL">
                        <Input placeholder="https://display.example.com/video.mp4"/>
                    </Form.Item>
                    <Form.Item name="line" label="Production Line" extra="Leave empty for default display">
                        <Input placeholder="e.g., LINE-A"/>
                    </Form.Item>
                    <Form.Item label="Upload Media (Max 50MB)"
                               extra={data.FilePath ? `Current: ${data.FilePath}` : "Video: MP4/WEBM/OGG. Image: PNG/JPG/GIF/WEBP"}>
                        <Upload beforeUpload={(file) => {
                            if (file.size > 50 * 1024 * 1024) {
                                message.error("File size exceeds 50MB");
                                return Upload.LIST_IGNORE;
                            }
                            setMediaFile(file);
                            return false;
                        }} maxCount={1} onRemove={() => setMediaFile(null)}>
                            <Button icon={<UploadOutlined/>}>Select Media</Button>
                        </Upload>
                    </Form.Item>
                    <Form.Item name="isOpen" label="Auto Open" valuePropName="checked"
                               extra="Automatically open the display when system starts"><Switch/></Form.Item>
                    <Form.Item name="loop" label="Loop" valuePropName="checked"
                               extra="Continuously loop the display content"><Switch/></Form.Item>
                </Form>
            ) : (
                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Description">{data.Description}</Descriptions.Item>
                    <Descriptions.Item label="URL">{data.Url || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Media">{data.FilePath || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Production Line">{data.Line || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Auto Open"><Tag
                        color={data.IsOpen ? "green" : "default"}>{data.IsOpen ? "Yes" : "No"}</Tag></Descriptions.Item>
                    <Descriptions.Item label="Loop"><Tag
                        color={data.Loop ? "green" : "default"}>{data.Loop ? "Yes" : "No"}</Tag></Descriptions.Item>
                </Descriptions>
            )}
        </Modal>
    );
}
