/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import {
  CheckOutlined,
  CopyOutlined,
  ReloadOutlined,
  SaveOutlined,
  SendOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "@/store";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
import {
  changeRevision,
  createRevision,
  fetchBomComparison,
  fetchRevision,
} from "@/store/features/traceability/traceabilitySlice";
import type { BomRevision } from "@/store/features/traceability/types";
import { fetchMaterial } from "@/store/features/master/materialSlice";
type Line = { materialId: number; qty: number; label: string };
export default function RevisionDetails({ id }: { id: string }) {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { message } = App.useApp();
  const { can, actor } = usePhasePermission();
  const materials = useSelector((s: RootState) => s.material);
  const [revision, setRevision] = useState<BomRevision | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [comparison, setComparison] = useState<
    {
      materialId: number;
      partNumber: string;
      before: number;
      after: number;
      change: string;
    }[]
  >([]);
  const [action, setAction] = useState<
    "submit" | "approve" | "reject" | "cancel" | null
  >(null);
  const [actionReason, setActionReason] = useState("");
  const [addMaterial, setAddMaterial] = useState<number>();
  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [r, c] = await Promise.all([
          dispatch(fetchRevision(id)).unwrap(),
          dispatch(fetchBomComparison({ id })).unwrap(),
        ]);
        if (alive) {
          setRevision(r);
          setReason(r.Reason);
          setLines(
            r.Lines.map((l) => ({
              materialId: l.MaterialId,
              qty: l.Qty,
              label: `${l.PartNumber} — ${l.PartName}`,
            })),
          );
          setComparison(c);
        }
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dispatch, id, refresh]);
  const hasUnsavedChanges =
    !!revision &&
    (reason !== revision.Reason ||
      JSON.stringify(
        lines.map(({ materialId, qty }) => ({ materialId, qty })),
      ) !==
        JSON.stringify(
          revision.Lines.map((l) => ({ materialId: l.MaterialId, qty: l.Qty })),
        ));
  const editable =
    revision?.Status === "DRAFT" && can("IPCS.BOM_REVISION_UPDATE");
  const execute = async (
    kind: "edit" | "submit" | "approve" | "reject" | "cancel",
  ) => {
    if (!revision) return;
    if (
      !reason.trim() ||
      ((kind === "reject" || kind === "cancel") && !actionReason.trim())
    ) {
      message.error("Reason is required.");
      return;
    }
    if (kind === "submit" && hasUnsavedChanges) {
      message.error("Save component changes before submitting.");
      return;
    }
    setSaving(true);
    try {
      await dispatch(
        changeRevision({
          id,
          action: kind,
          expectedVersion: revision.Version,
          reason: kind === "edit" ? reason : actionReason || undefined,
          ...(kind === "edit"
            ? {
                expectedActiveRevisionId:
                  revision.FinishGood.ActiveBomRevisionId,
                lines: lines.map(({ materialId, qty }) => ({
                  materialId,
                  qty,
                })),
              }
            : {}),
        }),
      ).unwrap();
      setAction(null);
      setActionReason("");
      setRefresh((n) => n + 1);
      message.success("BOM revision updated.");
    } catch (e) {
      message.error(String(e));
    } finally {
      setSaving(false);
    }
  };
  const copy = async () => {
    if (!revision) return;
    setSaving(true);
    try {
      const r = await dispatch(
        createRevision({
          finishGoodId: revision.FinishGoodId,
          copyFromId: id,
          reason: `Revision of BOM ${revision.Revision}`,
        }),
      ).unwrap();
      router.push(`/apps/master-data/bill-of-materials/${r.Id}`);
    } catch (e) {
      message.error(String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card
      variant="borderless"
      styles={{ body: { padding: 0 } }}
      loading={loading}
    >
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "Master Data" },
          {
            title: (
              <Link href="/apps/master-data/bill-of-materials">
                Bill of Materials
              </Link>
            ),
          },
          { title: "Revision Detail" },
        ]}
      />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => setRefresh((n) => n + 1)}
        />
        <ButtonToolbar
          title="New Revision"
          icon={<CopyOutlined />}
          enable={
            Boolean(revision) && can("IPCS.BOM_REVISION_CREATE") && !saving
          }
          onClick={() => void copy()}
        />
        <ButtonToolbar
          title="Save Draft"
          icon={<SaveOutlined />}
          enable={editable && !saving}
          onClick={() => void execute("edit")}
        />
        <ButtonToolbar
          title="Submit"
          icon={<SendOutlined />}
          enable={
            revision?.Status === "DRAFT" &&
            can("IPCS.BOM_REVISION_SUBMIT") &&
            !hasUnsavedChanges &&
            !saving
          }
          onClick={() => setAction("submit")}
        />
        <ButtonToolbar
          title="Approve"
          icon={<CheckOutlined />}
          enable={
            revision?.Status === "SUBMITTED" &&
            can("IPCS.BOM_REVISION_APPROVE") &&
            actor !== revision.CreatedBy &&
            actor !== revision.LastEditedBy &&
            !saving
          }
          onClick={() => setAction("approve")}
        />
        <ButtonToolbar
          title="Reject"
          icon={<StopOutlined />}
          enable={
            revision?.Status === "SUBMITTED" &&
            can("IPCS.BOM_REVISION_APPROVE") &&
            !saving
          }
          onClick={() => setAction("reject")}
        />
        <ButtonToolbar
          title="Cancel Draft"
          icon={<StopOutlined />}
          enable={editable && !saving}
          onClick={() => setAction("cancel")}
        />
      </ToolbarWrapper>
      {error && <Alert type="error" title={error} />}
      {revision && (
        <>
          {(revision.Status === "DRAFT" || revision.Status === "SUBMITTED") &&
            revision.BaseRevisionId !==
              revision.FinishGood.ActiveBomRevisionId && (
              <Alert
                type="warning"
                title="Active BOM has changed. Review Comparison against the current active revision, then save the reviewed draft before submitting again."
              />
            )}
          <Descriptions
            size="small"
            bordered
            column={3}
            style={{ marginTop: 12, marginBottom: 12 }}
            items={[
              {
                key: "fg",
                label: "Finish Good",
                children: revision.FinishGood.PartNumber,
              },
              {
                key: "revision",
                label: "Revision",
                children: revision.Revision,
              },
              {
                key: "status",
                label: "Status",
                children: <Tag>{revision.Status}</Tag>,
              },
              {
                key: "maker",
                label: "Created By",
                children: revision.CreatedBy,
              },
              {
                key: "approver",
                label: "Approved By",
                children: revision.ApprovedBy ?? "-",
              },
              {
                key: "version",
                label: "Edit Version",
                children: revision.Version,
              },
            ]}
          />
          <Form layout="vertical">
            <Form.Item label="Change Reason" required>
              <Input.TextArea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={!editable}
                maxLength={1000}
              />
            </Form.Item>
          </Form>
          <Tabs
            items={[
              {
                key: "components",
                label: "Components",
                children: (
                  <>
                    <Table<Line>
                      size="small"
                      className="small-table"
                      rowKey="materialId"
                      dataSource={lines}
                      pagination={false}
                      columns={[
                        { title: "Material", dataIndex: "label" },
                        {
                          title: "Qty / Unit",
                          render: (_, r) => (
                            <InputNumber
                              min={1}
                              max={1000000}
                              precision={0}
                              value={r.qty}
                              disabled={!editable}
                              onChange={(value) =>
                                setLines((old) =>
                                  old.map((l) =>
                                    l.materialId === r.materialId
                                      ? { ...l, qty: value ?? 1 }
                                      : l,
                                  ),
                                )
                              }
                            />
                          ),
                        },
                        {
                          title: "Action",
                          render: (_, r) =>
                            editable && (
                              <Button
                                danger
                                size="small"
                                onClick={() =>
                                  setLines((old) =>
                                    old.filter(
                                      (l) => l.materialId !== r.materialId,
                                    ),
                                  )
                                }
                              >
                                Remove
                              </Button>
                            ),
                        },
                      ]}
                    />
                    {editable && (
                      <Space style={{ marginTop: 12 }}>
                        <Select
                          style={{ width: 420 }}
                          placeholder="Search material"
                          showSearch
                          filterOption={false}
                          value={addMaterial}
                          onChange={setAddMaterial}
                          onSearch={(search) =>
                            void dispatch(fetchMaterial({ search, limit: 50 }))
                          }
                          onOpenChange={(v) =>
                            v && void dispatch(fetchMaterial({ limit: 50 }))
                          }
                          loading={materials.loading}
                          options={materials.data
                            .filter(
                              (m) => !lines.some((l) => l.materialId === m.Id),
                            )
                            .map((m) => ({
                              value: m.Id,
                              label: `${m.PartNumber} — ${m.PartName}`,
                            }))}
                        />
                        <Button
                          onClick={() => {
                            const m = materials.data.find(
                              (m) => m.Id === addMaterial,
                            );
                            if (m) {
                              setLines((old) => [
                                ...old,
                                {
                                  materialId: m.Id,
                                  qty: 1,
                                  label: `${m.PartNumber} — ${m.PartName}`,
                                },
                              ]);
                              setAddMaterial(undefined);
                            }
                          }}
                        >
                          Add Material
                        </Button>
                      </Space>
                    )}
                  </>
                ),
              },
              {
                key: "compare",
                label: "Comparison",
                children: (
                  <Table
                    size="small"
                    rowKey="materialId"
                    dataSource={comparison}
                    columns={[
                      { title: "Material", dataIndex: "partNumber" },
                      { title: "Before", dataIndex: "before" },
                      { title: "After", dataIndex: "after" },
                      { title: "Change", dataIndex: "change" },
                    ]}
                  />
                ),
              },
              {
                key: "usage",
                label: "Used by Production",
                children: (
                  <Table
                    size="small"
                    rowKey="Id"
                    dataSource={revision.Snapshots}
                    columns={[
                      {
                        title: "PO",
                        render: (_, r) => (
                          <Link
                            href={`/apps/traceability?poId=${encodeURIComponent(r.ForecastId)}`}
                          >
                            {r.ForecastId}
                          </Link>
                        ),
                      },
                      { title: "Snapshot Version", dataIndex: "Version" },
                      {
                        title: "Created At",
                        render: (_, r) =>
                          new Date(r.CreatedAt).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          }),
                      },
                    ]}
                  />
                ),
              },
              {
                key: "history",
                label: "Approval History",
                children: (
                  <Table
                    size="small"
                    rowKey="Id"
                    dataSource={revision.Events}
                    columns={[
                      {
                        title: "Time",
                        render: (_, r) =>
                          new Date(r.CreatedAt).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          }),
                      },
                      { title: "Action", dataIndex: "Action" },
                      { title: "Actor", dataIndex: "Actor" },
                      { title: "Reason", dataIndex: "Reason" },
                    ]}
                  />
                ),
              },
            ]}
          />
        </>
      )}
      <Modal
        centered
        open={Boolean(action)}
        title={`${action ?? ""} BOM Revision`}
        onCancel={() => setAction(null)}
        confirmLoading={saving}
        onOk={() => action && void execute(action)}
      >
        <p>
          Action applies to the saved revision. Approved revisions remain
          immutable.
        </p>
        <Input.TextArea
          placeholder="Reason (required for rejection/cancellation)"
          value={actionReason}
          onChange={(e) => setActionReason(e.target.value)}
          maxLength={1000}
        />
      </Modal>
    </Card>
  );
}
