"use client";

import {App, Button, Descriptions, Modal, Space, Tag} from "antd";
import {DeleteOutlined} from "@ant-design/icons";
import {useState} from "react";
import {useDispatch} from "react-redux";
import {AppDispatch} from "@/store";
import {
    deleteProductionReport,
    type ProductionReportEntity
} from "@/store/features/production/productionReport/productionReportSlice";
import {usePhasePermission} from "@/components/traceability/usePhasePermission";

interface Props {
    report: ProductionReportEntity | null;
    onClose: () => void;
    onDeleted: () => void;
}

const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString("id-ID", {timeZone: "Asia/Jakarta"}) : "-";

export default function DetailProductionReportModal({report, onClose, onDeleted}: Props) {
    const {message, modal} = App.useApp();
    const dispatch = useDispatch<AppDispatch>();
    const {can} = usePhasePermission();
    const [deleting, setDeleting] = useState(false);

    const handleDelete = () => {
        if (!report || report.validatedAt || !can("IPCS.PRODUCTION_REPORT_DELETE") || deleting) return;
        modal.confirm({
            title: "Delete Production Report?",
            icon: <DeleteOutlined/>,
            content: `Delete report for ${report.fgData?.PartNumber || report.finishGoodId}?`,
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            centered: true,
            onOk: async () => {
                setDeleting(true);
                try {
                    await dispatch(deleteProductionReport(report.id)).unwrap();
                    message.success("Production report deleted");
                    onDeleted();
                } catch (error: unknown) {
                    message.error(typeof error === "string" ? error : "Failed to delete production report");
                    throw error;
                } finally {
                    setDeleting(false);
                }
            },
        });
    };

    return (
        <Modal
            title={`Production Report Detail · ${report?.fgData?.PartNumber ?? ""}`}
            open={Boolean(report)}
            onCancel={onClose}
            footer={
                <Space>
                    {report && !report.validatedAt && can("IPCS.PRODUCTION_REPORT_DELETE") && (
                        <Button danger icon={<DeleteOutlined/>} onClick={handleDelete}
                                loading={deleting}>Delete</Button>
                    )}
                    <Button onClick={onClose}>Close</Button>
                </Space>
            }
            centered
            width={780}
            destroyOnHidden
        >
            {report && (
                <Descriptions bordered size="small" column={{xs: 1, sm: 2}}>
                    <Descriptions.Item
                        label="Finish Good">{report.fgData?.PartNumber || report.finishGoodId} - {report.fgData?.PartName || "-"}</Descriptions.Item>
                    <Descriptions.Item
                        label="PO Number">{report.forecastData?.PoId || report.forecastId || report.poNumber || "-"}</Descriptions.Item>
                    <Descriptions.Item
                        label="Manpower">{report.manPowerData?.Name || report.manPowerUid}</Descriptions.Item>
                    <Descriptions.Item label="Part Type"><Tag>{report.recordType}</Tag></Descriptions.Item>
                    <Descriptions.Item
                        label="Production Date">{new Date(report.date).toLocaleDateString("id-ID")}</Descriptions.Item>
                    <Descriptions.Item label="Production Time">{report.time || "-"}</Descriptions.Item>
                    <Descriptions.Item label="Qty">{report.qty}</Descriptions.Item>
                    <Descriptions.Item label="NG Qty">{report.ngQty}</Descriptions.Item>
                    <Descriptions.Item label="Stop Time">{report.stopMinute} minutes</Descriptions.Item>
                    <Descriptions.Item label="Production Stamp">{dateTime(report.productionStamp)}</Descriptions.Item>
                    <Descriptions.Item label="Start">{dateTime(report.startStamp)}</Descriptions.Item>
                    <Descriptions.Item label="End">{dateTime(report.endStamp)}</Descriptions.Item>
                    <Descriptions.Item label="Validation"><Tag
                        color={report.validatedAt ? "success" : "warning"}>{report.validatedAt ? "Validated" : "Pending"}</Tag></Descriptions.Item>
                    <Descriptions.Item label="Validated By">{report.validatedBy || "-"}</Descriptions.Item>
                </Descriptions>
            )}
        </Modal>
    );
}
