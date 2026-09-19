/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";

import React, {useRef, useState} from "react";
import {App, Button} from "antd";
import {DeleteOutlined, EditOutlined} from "@ant-design/icons";
import {useDispatch} from "react-redux";
import {AppDispatch} from "@/store";
import {
    deleteProductionRelease,
    ProductionReleaseEntity,
} from "@/store/features/production/productionRelease/productionReleaseSlice";
import DetailProductionReleaseModal from "./DetailProductionReleaseModal";
import EditProductionReleaseModal from "./EditProductionReleaseModal";

interface Props {
    open: boolean;
    data: ProductionReleaseEntity | null;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted: () => void;
}

export default function ProductionReleaseModal({open, data, onClose, onUpdated, onDeleted}: Props) {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [editing, setEditing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const deleteInFlight = useRef(false);

    if (!data) return null;

    const handleDelete = () => {
        if (data.Status !== "DRAFT" || deleteInFlight.current) return;
        modal.confirm({
            title: "Delete Production Release?",
            icon: <DeleteOutlined/>,
            content: `Delete release ${data.ReleaseNumber}?`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                if (deleteInFlight.current) return;
                deleteInFlight.current = true;
                setDeleting(true);
                try {
                    await dispatch(deleteProductionRelease(data.Id)).unwrap();
                    message.success("Production release deleted successfully");
                    onDeleted();
                    onClose();
                } catch (error: unknown) {
                    message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to delete production release");
                    throw error;
                } finally {
                    deleteInFlight.current = false;
                    setDeleting(false);
                }
            },
        });
    };

    if (editing) {
        return <EditProductionReleaseModal visible={open} data={data} onClose={() => setEditing(false)}
                                           onSuccess={() => {
                                               setEditing(false);
                                               onUpdated();
                                           }}/>;
    }

    return <DetailProductionReleaseModal
        visible={open}
        data={data}
        busy={deleting}
        onClose={onClose}
        footer={[
            data.Status === "DRAFT" && <Button key="delete" danger icon={<DeleteOutlined/>} loading={deleting}
                                               onClick={handleDelete}>Delete</Button>,
            <Button key="edit" type="primary" icon={<EditOutlined/>} disabled={deleting}
                    onClick={() => setEditing(true)}>Edit</Button>,
        ]}
    />;
}
