/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, App, Button, Checkbox, Modal, Table, Upload } from "antd";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  previewNonPo,
  importNonPo,
  type ImportPreview,
} from "@/store/features/production/forecastNonPo/forecastNonPoSlice";
import { createAssemblyRequestId } from "@/store/features/production/assembly/requestId";
export default function ImportNonPoModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const sequence = useRef(0);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState(false);
  const [requestId, setRequestId] = useState("");
  useEffect(() => {
    sequence.current++;
    setFile(undefined);
    setPreview(undefined);
    setDuplicates(false);
    setBusy(false);
    setRequestId(createAssemblyRequestId());
  }, [open]);
  const choose = async (next: File) => {
    const current = ++sequence.current;
    setBusy(true);
    setFile(next);
    setPreview(undefined);
    setDuplicates(false);
    setRequestId(createAssemblyRequestId());
    try {
      const result = await dispatch(previewNonPo(next)).unwrap();
      if (current === sequence.current) setPreview(result);
    } catch (error) {
      if (current === sequence.current) message.error(String(error));
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  };
  const submit = async () => {
    if (!file || !preview || busy) return;
    setBusy(true);
    try {
      const result = await dispatch(
        importNonPo({ file, requestId, confirmDuplicates: duplicates }),
      ).unwrap();
      message.success(
        result.replayed
          ? "File was already imported; no additional records created."
          : `${result.created} forecasts imported`,
      );
      onSaved();
      onClose();
    } catch (error) {
      message.error(String(error));
    } finally {
      setBusy(false);
    }
  };
  const invalid =
    !preview ||
    !preview.total ||
    preview.rows.some((row) => row.errors.length > 0) ||
    (preview.rows.some((row) => row.duplicate) && !duplicates);
  return (
    <Modal
      open={open}
      title="Import Forecast (Non PO)"
      centered
      width={1000}
      onCancel={onClose}
      onOk={() => void submit()}
      confirmLoading={busy}
      okButtonProps={{ disabled: invalid || busy || preview?.alreadyImported }}
      okText="Import"
    >
      <Upload
        accept=".xlsx"
        maxCount={1}
        showUploadList={false}
        beforeUpload={(next) => {
          void choose(next);
          return false;
        }}
        disabled={busy}
      >
        <Button>Select Excel file</Button>
      </Upload>
      <p>{file?.name}</p>
      {preview?.alreadyImported && (
        <Alert
          type="info"
          title="This file has already been imported. No additional records will be created."
        />
      )}
      <Table
        rowKey="rowNumber"
        dataSource={preview?.rows ?? []}
        size="small"
        loading={busy}
        scroll={{ x: 1000 }}
        columns={[
          { title: "Row", dataIndex: "rowNumber" },
          ...(
            [
              "partNumber",
              "deliveryDate",
              "receivingArea",
              "deliveryPeriod",
              "qty",
              "poNumber",
              "notes",
            ] as const
          ).map((key) => ({ title: key, dataIndex: ["values", key] })),
          {
            title: "Validation",
            render: (_, row) =>
              row.errors.join("; ") ||
              (row.duplicate ? "Duplicate — confirmation required" : "Valid"),
          },
        ]}
      />
      <Checkbox
        checked={duplicates}
        onChange={(event) => setDuplicates(event.target.checked)}
      >
        I confirm duplicate rows are separate additional requests.
      </Checkbox>
    </Modal>
  );
}
