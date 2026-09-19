"use client";

import { useEffect, useState } from "react";
import { Alert, Descriptions, Modal, Tag } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  fetchFinishGoodByPartNumber,
  type FinishGoodEntity,
} from "@/store/features/master/finishGoodSlice";
import { formatDateTime } from "@/lib/utils/dateTime";

interface Props {
  open: boolean;
  partNumber: string | null;
  onClose: () => void;
}

export default function FinishGoodLinkedModal({ open, partNumber, onClose }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const [finishGood, setFinishGood] = useState<FinishGoodEntity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !partNumber) {
      setFinishGood(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void dispatch(fetchFinishGoodByPartNumber(partNumber))
      .unwrap()
      .then((response) => {
        if (active) setFinishGood(response.data);
      })
      .catch((reason: unknown) => {
        if (active) setError(typeof reason === "string" ? reason : "Failed to load Finish Good detail");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dispatch, open, partNumber]);

  return (
    <Modal
      title={<span><ArrowRightOutlined style={{ color: "#d4a106", marginRight: 8 }} />Finish Good Detail{partNumber ? ` - ${partNumber}` : ""}</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={760}
      destroyOnHidden
      loading={loading}
    >
      {error && <Alert type="error" title={error} showIcon style={{ marginBottom: 12 }} />}
      {finishGood && (
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Part Number"><code>{finishGood.PartNumber}</code></Descriptions.Item>
          <Descriptions.Item label="Part Name">{finishGood.PartName}</Descriptions.Item>
          <Descriptions.Item label="Alias">{finishGood.Alias || "-"}</Descriptions.Item>
          <Descriptions.Item label="Passthrough"><Tag>{finishGood.IsPassthrough ? "Yes" : "No"}</Tag></Descriptions.Item>
          <Descriptions.Item label="Stock">{finishGood.Qty}</Descriptions.Item>
          <Descriptions.Item label="Price">{finishGood.Price !== null ? `Rp ${finishGood.Price.toLocaleString("id-ID")}` : "-"}</Descriptions.Item>
          <Descriptions.Item label="Created By">{finishGood.CreatedByName || finishGood.CreatedBy || "-"}</Descriptions.Item>
          <Descriptions.Item label="Created At">{formatDateTime(finishGood.CreatedAt)}</Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
