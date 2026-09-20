/* By Irfan Akbari Vuteq Indonesia - 2026-09-20 */
"use client";

import {useEffect, useState} from "react";
import {Button, Descriptions, Input, InputNumber, Modal, Radio, Space, Table} from "antd";
import type {NgCase, NgDetail, ShoppingRecord} from "@/store/features/traceability/types";

type CloseAction = "CLOSE" | "CANCEL";

type MaterialNgDetailModalProps = {
    open: boolean;
    data: NgCase | null;
    quantities: Record<number, number>;
    saving: boolean;
    canIssue: boolean;
    canClose: boolean;
    onClose: () => void;
    onQuantityChange: (detailId: number, quantity: number) => void;
    onIssue: () => void;
    onCloseCase: (action: CloseAction, reason: string) => Promise<boolean>;
};

export default function MaterialNgDetailModal({
                                                  open,
                                                  data,
                                                  quantities,
                                                  saving,
                                                  canIssue,
                                                  canClose,
                                                  onClose,
                                                  onQuantityChange,
                                                  onIssue,
                                                  onCloseCase,
                                              }: MaterialNgDetailModalProps) {
    const [closing, setClosing] = useState(false);
    const [closeReason, setCloseReason] = useState("");
    const [closeAction, setCloseAction] = useState<CloseAction>("CLOSE");

    useEffect(() => {
        if (!open) setClosing(false);
    }, [open]);

    const beginClose = () => {
        setCloseReason("");
        setCloseAction("CLOSE");
        setClosing(true);
    };

    const submitClose = async () => {
        if (!closeReason.trim()) return;
        if (await onCloseCase(closeAction, closeReason.trim())) setClosing(false);
    };

    return (
        <Modal
            centered
            width="min(1100px, 96vw)"
            open={open}
            title={data ? `Material NG Case — ${data.CaseNumber}` : "Material NG Case"}
            onCancel={onClose}
            footer={null}
            destroyOnHidden
            styles={{body: {maxHeight: "calc(100vh - 160px)", overflowY: "auto"}}}
        >
            {data && (
                <>
                    <Descriptions
                        bordered
                        size="small"
                        style={{marginBottom: 16}}
                        items={[
                            {key: "case", label: "Case", children: data.CaseNumber},
                            {key: "po", label: "PO", children: data.ForecastId},
                            {key: "status", label: "Status", children: data.Status},
                            {key: "reason", label: "Reason", children: data.Reason},
                            {key: "closed", label: "Closure Reason", children: data.CloseReason ?? "-"},
                        ]}
                    />
                    <Table<NgDetail>
                        size="small"
                        rowKey="Id"
                        dataSource={data.Details}
                        pagination={false}
                        scroll={{x: "max-content"}}
                        columns={[
                            {title: "Material", dataIndex: "MaterialId"},
                            {title: "NG Qty", dataIndex: "Qty"},
                            {title: "Requested Replacement", dataIndex: "ReplacementRequestedQty"},
                            {
                                title: "Issued",
                                render: (_, record) => record.Replacements.reduce((total, replacement) => total + replacement.QtyPick, 0),
                            },
                            {
                                title: "Issue Now",
                                render: (_, record) => (
                                    <InputNumber
                                        min={0}
                                        max={record.ReplacementRequestedQty - record.Replacements.reduce((total, replacement) => total + replacement.QtyPick, 0)}
                                        precision={0}
                                        value={quantities[record.Id] ?? 0}
                                        disabled={data.Status !== "OPEN" || !canIssue || saving}
                                        onChange={(value) => onQuantityChange(record.Id, value ?? 0)}
                                    />
                                ),
                            },
                        ]}
                        expandable={{
                            expandedRowRender: (record) => (
                                <Table<ShoppingRecord>
                                    size="small"
                                    rowKey="Id"
                                    dataSource={record.Replacements}
                                    pagination={false}
                                    columns={[
                                        {title: "Qty", dataIndex: "QtyPick"},
                                        {title: "Actor", dataIndex: "CreatedBy"},
                                        {
                                            title: "Time",
                                            render: (_, replacement) => new Date(replacement.CreatedAt).toLocaleString("id-ID", {timeZone: "Asia/Jakarta"}),
                                        },
                                    ]}
                                />
                            ),
                        }}
                    />
                    <Space style={{marginTop: 12}}>
                        <Button
                            type="primary"
                            loading={saving}
                            disabled={data.Status !== "OPEN" || !canIssue}
                            onClick={onIssue}
                        >
                            Issue Replacement
                        </Button>
                        <Button
                            disabled={!canClose || ["CLOSED", "CANCELLED"].includes(data.Status)}
                            onClick={beginClose}
                        >
                            Close / Cancel Case
                        </Button>
                    </Space>
                    <Modal
                        centered
                        open={closing}
                        title="Close Material NG Case"
                        onCancel={() => setClosing(false)}
                        onOk={() => void submitClose()}
                        okButtonProps={{disabled: !closeReason.trim()}}
                        confirmLoading={saving}
                        destroyOnHidden
                    >
                        <Space orientation="vertical" style={{width: "100%"}}>
                            <Radio.Group
                                value={closeAction}
                                onChange={(event) => setCloseAction(event.target.value)}
                                options={[
                                    {value: "CLOSE", label: "Close remaining requirement"},
                                    {value: "CANCEL", label: "Cancel (no replacement issued)"},
                                ]}
                            />
                            <Input.TextArea
                                value={closeReason}
                                onChange={(event) => setCloseReason(event.target.value)}
                                placeholder="Required reason"
                                maxLength={1000}
                            />
                        </Space>
                    </Modal>
                </>
            )}
        </Modal>
    );
}
