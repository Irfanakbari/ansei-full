"use client";

import {useEffect, useRef, useState} from "react";
import {DeleteOutlined, EditOutlined, EyeOutlined} from "@ant-design/icons";
import {App, Button, Descriptions, Form, InputNumber, Modal, Select, Space} from "antd";
import {useDispatch, useSelector} from "react-redux";
import {AppDispatch, RootState} from "@/store";
import {BoxQTYEntity, deleteBoxQTY, updateBoxQTY} from "@/store/features/master/boxQtySlice";
import {fetchFinishGood} from "@/store/features/master/finishGoodSlice";
import {formatDateTime} from "@/lib/utils/dateTime";

type FormValues = { partNumber?: string; qty?: number };

type Props = {
    visible: boolean;
    data: BoxQTYEntity | null;
    onClose: () => void;
    onUpdated: () => void;
    onDeleted: () => void;
};

export default function BoxQTYModal({visible, data, onClose, onUpdated, onDeleted}: Props) {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const [form] = Form.useForm<FormValues>();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const saveInFlight = useRef(false);
    const deleteInFlight = useRef(false);
    const {data: finishGoods, loading: finishGoodLoading} = useSelector((state: RootState) => state.finishGood);

    useEffect(() => {
        if (!visible) {
            setIsEditing(false);
        }
    }, [visible]);

    useEffect(() => {
        if (!visible || !isEditing || !data) return;
        form.setFieldsValue({partNumber: data.PartNumber, qty: data.Qty});
        void dispatch(fetchFinishGood());
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
            await dispatch(updateBoxQTY({
                id: data.Id,
                data: {partNumber: values.partNumber, qty: values.qty ? Number(values.qty) : undefined}
            })).unwrap();
            message.success("Box QTY updated successfully");
            form.resetFields();
            setIsEditing(false);
            onUpdated();
        } catch (error: unknown) {
            if (typeof error === "object" && error !== null && "errorFields" in error) return;
            message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to update box QTY");
        } finally {
            saveInFlight.current = false;
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (deleteInFlight.current) return;
        modal.confirm({
            title: "Delete Box QTY?",
            icon: <DeleteOutlined/>,
            content: `Part Number: ${data.PartNumber}`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                if (deleteInFlight.current) return;
                deleteInFlight.current = true;
                setIsDeleting(true);
                try {
                    await dispatch(deleteBoxQTY(data.Id)).unwrap();
                    message.success("Box QTY deleted successfully");
                    onDeleted();
                } catch (error: unknown) {
                    message.error(typeof error === "string" ? error : error instanceof Error ? error.message : "Failed to delete box QTY");
                    throw error;
                } finally {
                    deleteInFlight.current = false;
                    setIsDeleting(false);
                }
            },
        });
    };

    return (
        <Modal
            title={<Space>{isEditing ? <EditOutlined/> :
                <EyeOutlined/>}<span>{isEditing ? "Edit" : "Detail"} Box QTY</span></Space>}
            open={visible}
            onCancel={handleClose}
            centered
            width={500}
            destroyOnHidden
            zIndex={1050}
            mask={{closable: !isSaving && !isDeleting}}
            closable={!isSaving && !isDeleting}
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
            ]}
        >
            {isEditing ? (
                <Form form={form} layout="vertical">
                    <Form.Item name="partNumber" label="Finish Good">
                        <Select placeholder="Select finish good" loading={finishGoodLoading}
                                showSearch={{optionFilterProp: "label"}} options={finishGoods.map((finishGood) => ({
                            value: finishGood.PartNumber,
                            label: `${finishGood.PartNumber} - ${finishGood.PartName}`
                        }))}/>
                    </Form.Item>
                    <Form.Item name="qty" label="Qty Per Box">
                        <InputNumber placeholder="0" min={1} style={{width: "100%"}}/>
                    </Form.Item>
                </Form>
            ) : (
                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Part Number">{data.PartNumber}</Descriptions.Item>
                    <Descriptions.Item label="Finish Good">{data.PartData?.PartName || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Qty Per Box">{data.Qty}</Descriptions.Item>
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
