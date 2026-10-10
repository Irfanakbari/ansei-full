/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */

"use client";

import { useEffect, useState } from "react";

import { Alert, Button, Descriptions, Modal, Space, Spin, Table } from "antd";

import { ReloadOutlined } from "@ant-design/icons";

import { useDispatch } from "react-redux";

import type { AppDispatch } from "@/store";

import {
  fetchSapBom,
  type SapBomPreview,
} from "@/store/features/master/bomSlice";

import { formatDateTime } from "@/lib/utils/dateTime";

const componentTypes: Record<string, string> = {
  pit_Item: "Material",
  pit_Resource: "Resource",
  pit_Text: "Text",
};

const statusMessages = {
  NOT_FOUND: "No BOM was found in SAP for this SAP part number.",

  UNKNOWN: "SAP BOM is temporarily unavailable. Please try again shortly.",

  DISABLED: "SAP integration is disabled.",

  UNMAPPED: "Set the finish good SAP part number before loading its SAP BOM.",
};

export default function SapBomModal({
  finishGoodId,
  onClose,
}: {
  finishGoodId: number | null;

  onClose: () => void;
}) {
  const dispatch = useDispatch<AppDispatch>();

  const [data, setData] = useState<SapBomPreview | null>(null);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (finishGoodId === null) return;

    let alive = true;

    setData(null);

    setError("");

    setLoading(true);

    const request = dispatch(fetchSapBom(finishGoodId));

    void request
      .unwrap()
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((reason: unknown) => {
        if (alive)
          setError(
            typeof reason === "string" ? reason : "Failed to load SAP BOM",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      request.abort();
    };
  }, [dispatch, finishGoodId, refresh]);

  return (
    <Modal
      centered
      title="SAP Bill of Materials"
      open={finishGoodId !== null}

      onCancel={onClose}
      footer={null}
      width={950}
      destroyOnHidden
    >
      <Space orientation="vertical" style={{ width: "100%" }}>
        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => setRefresh((n) => n + 1)}
        >
          Refresh
        </Button>

        {error && <Alert type="error" title={error} showIcon />}

        {loading && <Spin />}

        {data && data.finishGoodId === finishGoodId && (
          <>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: "fg",
                  label: "Genba Part Number",
                  children: data.partNumber,
                },

                {
                  key: "sap",
                  label: "SAP Part Number",
                  children: data.sapPartNumber ?? "-",
                },

                {
                  key: "checked",
                  label: "Last Checked",
                  children: data.checkedAt
                    ? formatDateTime(data.checkedAt)
                    : "-",
                },
              ]}
            />

            {data.stale && (
              <Alert
                showIcon
                type="warning"
                title="Showing cached SAP data. Refresh again shortly to see the latest result."
              />
            )}

            {data.status !== "FOUND" && (
              <Alert
                showIcon
                type={data.status === "UNKNOWN" ? "warning" : "info"}
                title={statusMessages[data.status]}
              />
            )}

            {data.bom && (
              <>
                <Descriptions
                  size="small"
                  column={1}
                  items={[
                    {
                      key: "description",
                      label: "SAP Description",
                      children: data.bom.ProductDescription ?? "-",
                    },

                    {
                      key: "quantity",
                      label: "BOM Base Quantity",
                      children: data.bom.Quantity,
                    },
                  ]}
                />

                <Table
                  size="small"
                  rowKey="LineNumber"
                  dataSource={data.bom.ProductTreeLines}

                  pagination={{ pageSize: 20 }}
                  scroll={{ x: "max-content" }}
                  columns={[
                    { title: "Line", dataIndex: "LineNumber" },

                    { title: "SAP Component", dataIndex: "ItemCode" },

                    {
                      title: "Type",
                      dataIndex: "ItemType",
                      render: (v: string | null) =>
                        v ? (componentTypes[v] ?? v) : "-",
                    },

                    { title: "Quantity", dataIndex: "Quantity" },

                    {
                      title: "Qty / FG Unit",
                      render: (_, line) => line.Quantity / data.bom!.Quantity,
                    },

                    {
                      title: "Warehouse",
                      dataIndex: "Warehouse",
                      render: (v: string | null, line) =>
                        line.WarehouseName
                          ? `${v} - ${line.WarehouseName}`
                          : (v ?? "-"),
                    },
                  ]}
                />

                <Alert
                  type="info"
                  showIcon
                  title="SAP reference BOM. Local component changes must be saved and approved through a BOM revision."
                />
              </>
            )}
          </>
        )}
      </Space>
    </Modal>
  );
}
