/* By Irfan Akbari Vuteq Indonesia - 2026-10-30 */
"use client";

import { Alert, App, Button, Modal, Space, Table, Tag, Upload } from "antd";
import type { UploadProps } from "antd";
import { FileExcelOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  applyInventoryCountingResultImport,
  previewInventoryCountingResultImport,
  type ResultImportPreviewItem,
  type ResultImportPreviewResponse,
} from "@/store/features/warehouse/inventoryCounting/inventoryCountingSlice";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface Props {
  open: boolean;
  inventoryCountingId: string;
  onClose: () => void;
  onApplied: () => void;
}

export default function InventoryCountingResultImportModal({
  open,
  inventoryCountingId,
  onClose,
  onApplied,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ResultImportPreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
  };

  const close = () => {
    if (previewing || applying) return;
    reset();
    onClose();
  };

  const previewFile = async (selectedFile: File) => {
    setPreviewing(true);
    setPreview(null);
    try {
      const result = await dispatch(
        previewInventoryCountingResultImport({
          id: inventoryCountingId,
          file: selectedFile,
        }),
      ).unwrap();
      setFile(selectedFile);
      setPreview(result);
    } catch (error: unknown) {
      setFile(null);
      message.error(typeof error === "string" ? error : "Failed to preview file");
    } finally {
      setPreviewing(false);
    }
  };

  const beforeUpload: UploadProps["beforeUpload"] = (selectedFile) => {
    if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      message.error("Select an .xlsx file.");
      return Upload.LIST_IGNORE;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      message.error("Excel file must not exceed 5MB.");
      return Upload.LIST_IGNORE;
    }
    void previewFile(selectedFile);
    return Upload.LIST_IGNORE;
  };

  const apply = async () => {
    if (!file || !preview?.canApply) return;
    setApplying(true);
    try {
      const result = await dispatch(
        applyInventoryCountingResultImport({ id: inventoryCountingId, file }),
      ).unwrap();
      message.success(`${result.updatedCount} Excel result row(s) applied.`);
      reset();
      onApplied();
      onClose();
    } catch (error: unknown) {
      message.error(typeof error === "string" ? error : "Failed to apply file");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal
      title="Import Excel Counting Results"
      open={open}
      centered
      width={880}
      destroyOnHidden
      onCancel={close}
      onOk={apply}
      okText="Apply Results"
      confirmLoading={applying}
      okButtonProps={{ disabled: !preview?.canApply || previewing }}
    >
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          title="Required columns: A PartNumber, B Qty Warehouse, C Qty Rack"
          description="Preview validates every row against this inventory counting. Applying updates counting results only; stock and ledger changes remain in the approval and close workflow."
        />
        <Upload
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          beforeUpload={beforeUpload}
          showUploadList={false}
          disabled={previewing || applying}
        >
          <Button icon={<FileExcelOutlined />} loading={previewing}>
            Select Excel and Preview
          </Button>
        </Upload>
        {file && <span>{file.name}</span>}
        {preview && (
          <>
            <Alert
              type={preview.canApply ? "success" : "error"}
              showIcon
              title={`${preview.validRows} valid, ${preview.invalidRows} invalid of ${preview.totalRows} row(s)`}
              description={
                preview.canApply
                  ? "All rows are valid and ready to apply."
                  : "Correct invalid, duplicate, or unregistered part numbers and preview the file again."
              }
            />
            <Table<ResultImportPreviewItem>
              rowKey="rowNumber"
              size="small"
              dataSource={preview.items}
              pagination={{ pageSize: 10, size: "small" }}
              scroll={{ y: 320 }}
              columns={[
                { title: "Row", dataIndex: "rowNumber", width: 70 },
                { title: "Part Number", dataIndex: "partNumber" },
                {
                  title: "Qty Warehouse",
                  dataIndex: "qtyWarehouse",
                  align: "right",
                  render: (value: number | null) => value ?? "-",
                },
                {
                  title: "Qty Rack",
                  dataIndex: "qtyRack",
                  align: "right",
                  render: (value: number | null) => value ?? "-",
                },
                {
                  title: "Validation",
                  dataIndex: "status",
                  width: 150,
                  render: (value: ResultImportPreviewItem["status"]) => (
                    <Tag color={value === "VALID" ? "success" : "error"}>
                      {value.replace("_", " ")}
                    </Tag>
                  ),
                },
                {
                  title: "Message",
                  dataIndex: "message",
                  render: (value: string | null) => value ?? "-",
                },
              ]}
            />
          </>
        )}
      </Space>
    </Modal>
  );
}
