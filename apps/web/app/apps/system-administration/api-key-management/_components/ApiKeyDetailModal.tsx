/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import {useRef, useState} from "react";
import {DeleteOutlined, EyeOutlined} from "@ant-design/icons";
import {App, Button, Descriptions, Modal, Space, Tag} from "antd";
import {useDispatch} from "react-redux";
import {AppDispatch} from "@/store";
import {ApiKeyEntity, deleteApiKey} from "@/store/features/apiKeys/apiKeysSlice";
import {formatDateTime} from "@/lib/utils/dateTime";

type Props = {
    open: boolean;
    data: ApiKeyEntity | null;
    onClose: () => void;
    onDeleted: () => void;
};

const getErrorMessage = (error: unknown) => typeof error === "string"
    ? error
    : error instanceof Error ? error.message : "Failed to delete API Key";

export default function ApiKeyDetailModal({open, data, onClose, onDeleted}: Props) {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [deleting, setDeleting] = useState(false);
    const deleteInFlight = useRef(false);

    if (!data) return null;

    const handleClose = () => {
        if (!deleting) onClose();
    };

    const handleDelete = () => {
        if (deleteInFlight.current) return;
        modal.confirm({
            title: "Delete API Key?",
            icon: <DeleteOutlined/>,
            content: `Delete API Key "${data.Name}"?`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                if (deleteInFlight.current) return;
                deleteInFlight.current = true;
                setDeleting(true);
                try {
                    await dispatch(deleteApiKey(data.Id)).unwrap();
                    message.success("API Key successfully deleted");
                    onDeleted();
                } catch (error: unknown) {
                    message.error(getErrorMessage(error));
                    throw error;
                } finally {
                    deleteInFlight.current = false;
                    setDeleting(false);
                }
            },
        });
    };

    return (
        <Modal
            title={<Space><EyeOutlined/><span>API Key Details</span></Space>}
            open={open}
            onCancel={handleClose}
            centered
            width={600}
            destroyOnHidden
            mask={{closable: !deleting}}
            keyboard={!deleting}
            closable={!deleting}
            footer={[
                <Button key="delete" danger icon={<DeleteOutlined/>} onClick={handleDelete} loading={deleting}>
                    Delete
                </Button>,
            ]}
        >
            <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="Name">{data.Name}</Descriptions.Item>
                <Descriptions.Item label="Key Prefix">{data.KeyPrefix || "-"}</Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={data.IsActive ? "green" : "default"}>{data.IsActive ? "Active" : "Revoked"}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Last Used">
                    {data.LastUsedAt ? formatDateTime(data.LastUsedAt) : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Created By">
                    {data.CreatedByName || data.CreatedBy || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Created">{formatDateTime(data.CreatedAt)}</Descriptions.Item>
            </Descriptions>
        </Modal>
    );
}
