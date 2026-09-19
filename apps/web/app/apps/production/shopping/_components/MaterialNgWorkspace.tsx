/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
  Radio,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
import {
  closeNg,
  createNgCase,
  fetchBomSnapshots,
  fetchNgCase,
  fetchNgCases,
  issueNg,
  searchNgOrders,
} from "@/store/features/traceability/traceabilitySlice";
import type {
  BomSnapshot,
  NgCase,
  Page,
  TraceSearchRow,
} from "@/store/features/traceability/types";
type DraftLine = {
  materialId: string;
  name: string;
  perUnit: number;
  qtyNg: number;
  qtyReplacement: number;
};
export default function MaterialNgWorkspace() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const params = useSearchParams();
  const { message } = App.useApp();
  const { can } = usePhasePermission();
  const [result, setResult] = useState<Page<NgCase> | null>(null);
  const [selected, setSelected] = useState<NgCase | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<TraceSearchRow[]>([]);
  const [snapshot, setSnapshot] = useState<BomSnapshot | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [mode, setMode] = useState("MATERIAL");
  const [sets, setSets] = useState(1);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeAction, setCloseAction] = useState<"CLOSE" | "CANCEL">("CLOSE");
  const [form] = Form.useForm<{
    poId: string;
    stage: string;
    reason: string;
  }>();
  const requestIds = useRef(new Map<string, string>());
  const commandId = (payload: unknown) => {
    const key = JSON.stringify(payload);
    let id = requestIds.current.get(key);
    if (!id) {
      id = crypto.randomUUID();
      requestIds.current.set(key, id);
    }
    return id;
  };
  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const r = await dispatch(fetchNgCases({ page, search })).unwrap();
        if (live) setResult(r);
        const id = params.get("ngCaseId");
        if (id) {
          const c = await dispatch(fetchNgCase(id)).unwrap();
          if (live) setSelected(c);
        }
      } catch (e) {
        if (live) setError(String(e));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [dispatch, page, search, refresh, params]);
  const findOrders = async (value: string) => {
    try {
      setOrders(
        (await dispatch(searchNgOrders({ search: value, limit: 50 })).unwrap())
          .data,
      );
    } catch (e) {
      message.error(String(e));
    }
  };
  const selectPo = async (poId: string, options = orders) => {
    const order = options.find((o) => o.PoId === poId);
    setSnapshot(null);
    setLines([]);
    if (!order?.ProductionRelease) return;
    try {
      const list = await dispatch(
        fetchBomSnapshots(order.ProductionRelease.Id),
      ).unwrap();
      const s = list.find((s) => s.ForecastId === poId) ?? null;
      setSnapshot(s);
      setLines(
        s?.Lines.map((l) => ({
          materialId: l.PartNumber,
          name: l.PartName,
          perUnit: l.QtyPerUnit,
          qtyNg: 0,
          qtyReplacement: 0,
        })) ?? [],
      );
    } catch (e) {
      message.error(String(e));
    }
  };
  const begin = async () => {
    requestIds.current.clear();
    form.resetFields();
    setSnapshot(null);
    setLines([]);
    setMode("MATERIAL");
    setOpen(true);
    try {
      const list = (
        await dispatch(
          searchNgOrders({ search: params.get("poId") ?? "", limit: 50 }),
        ).unwrap()
      ).data;
      setOrders(list);
      const po = params.get("poId");
      if (po && list.some((o) => o.PoId === po)) {
        form.setFieldsValue({ poId: po });
        await selectPo(po, list);
      }
    } catch (e) {
      message.error(String(e));
    }
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      if (!snapshot) throw "Historical BOM snapshot is unavailable.";
      const picked = lines.filter((l) => l.qtyNg > 0);
      if (!picked.length) throw "Enter NG quantity for at least one material.";
      const body = {
        forecastId: values.poId,
        snapshotId: snapshot.Id,
        stage: values.stage,
        reason: values.reason,
        lines: picked.map((l) => ({
          materialId: l.materialId,
          qtyNg: l.qtyNg,
          qtyReplacement: l.qtyReplacement,
        })),
        ...(params.get("labelId")
          ? { labelId: Number(params.get("labelId")) }
          : {}),
        ...(params.get("assemblySessionId")
          ? { assemblySessionId: params.get("assemblySessionId")! }
          : {}),
        ...(params.get("productionReportId")
          ? { productionReportId: Number(params.get("productionReportId")) }
          : {}),
      };
      setSaving(true);
      const c = await dispatch(
        createNgCase({ ...body, requestId: commandId(body) }),
      ).unwrap();
      setSelected(c);
      setOpen(false);
      setQuantities({});
      setRefresh((v) => v + 1);
      message.success(
        "Material NG recorded. Rack stock has not been deducted again.",
      );
    } catch (e) {
      if (typeof e === "string") message.error(e);
    } finally {
      setSaving(false);
    }
  };
  const issue = async () => {
    if (!selected) return;
    const body = {
      id: selected.Id,
      lines: selected.Details.map((d) => ({
        detailId: d.Id,
        qty: quantities[d.Id] ?? 0,
      })).filter((l) => l.qty > 0),
    };
    if (!body.lines.length) {
      message.warning("Enter replacement quantity.");
      return;
    }
    setSaving(true);
    try {
      setSelected(
        await dispatch(
          issueNg({ ...body, requestId: commandId(body) }),
        ).unwrap(),
      );
      setQuantities({});
      setRefresh((v) => v + 1);
      message.success("Replacement issued.");
    } catch (e) {
      message.error(String(e));
    } finally {
      setSaving(false);
    }
  };
  const close = async () => {
    if (!selected || !closeReason.trim()) return;
    const body = { id: selected.Id, reason: closeReason, action: closeAction };
    setSaving(true);
    try {
      setSelected(
        await dispatch(
          closeNg({ ...body, requestId: commandId(body) }),
        ).unwrap(),
      );
      setClosing(false);
      setRefresh((v) => v + 1);
    } catch (e) {
      message.error(String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card variant="borderless" styles={{ body: { padding: 0 } }}>
      <Breadcrumb
        style={{ marginBottom: 16 }}
        items={[
          { title: "Home" },
          { title: "Production" },
          { title: <Link href="/apps/production/shopping">Shopping</Link> },
          { title: "NG Replacement" },
        ]}
      />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => setRefresh((v) => v + 1)}
        />
        <ButtonToolbar
          title="Report Material NG"
          icon={<PlusOutlined />}
          enable={can("IPCS.MATERIAL_NG_CREATE")}
          onClick={() => void begin()}
        />
      </ToolbarWrapper>
      <Tabs
        activeKey="NG"
        onChange={(key) =>
          router.push(`/apps/production/shopping?purpose=${key}`)
        }
        items={[
          { key: "STANDARD", label: "Standard" },
          { key: "NG", label: "NG Replacement" },
          { key: "NON_PRODUCTION", label: "Non-production" },
        ]}
      />
      <Input.Search
        placeholder="Search case or PO"
        allowClear
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        style={{ maxWidth: 400, marginBottom: 12 }}
      />
      {error && <Alert type="error" title={error} />}
      <Table<NgCase>
        size="small"
        className="small-table"
        loading={loading}
        rowKey="Id"
        dataSource={result?.data ?? []}
        rowSelection={{
          type: "radio",
          selectedRowKeys: selected ? [selected.Id] : [],
          onChange: (_, rows) => {
            setSelected(rows[0] ?? null);
            setQuantities({});
          },
        }}
        columns={[
          { title: "Case", dataIndex: "CaseNumber" },
          { title: "PO", dataIndex: "ForecastId" },
          { title: "Stage", dataIndex: "Stage" },
          { title: "Status", render: (_, r) => <Tag>{r.Status}</Tag> },
          { title: "Reason", dataIndex: "Reason" },
          { title: "Actor", dataIndex: "CreatedBy" },
        ]}
        pagination={{
          current: page,
          pageSize: 20,
          total: result?.meta.totalItems,
          onChange: setPage,
        }}
        scroll={{ x: "max-content" }}
      />
      {selected && (
        <>
          <Descriptions
            bordered
            size="small"
            style={{ margin: "16px 0" }}
            items={[
              { key: "case", label: "Case", children: selected.CaseNumber },
              { key: "po", label: "PO", children: selected.ForecastId },
              { key: "status", label: "Status", children: selected.Status },
              { key: "reason", label: "Reason", children: selected.Reason },
              {
                key: "closed",
                label: "Closure Reason",
                children: selected.CloseReason ?? "-",
              },
            ]}
          />
          <Table
            size="small"
            rowKey="Id"
            dataSource={selected.Details}
            pagination={false}
            columns={[
              { title: "Material", dataIndex: "MaterialId" },
              { title: "NG Qty", dataIndex: "Qty" },
              {
                title: "Requested Replacement",
                dataIndex: "ReplacementRequestedQty",
              },
              {
                title: "Issued",
                render: (_, r) =>
                  r.Replacements.reduce((n, s) => n + s.QtyPick, 0),
              },
              {
                title: "Issue Now",
                render: (_, r) => (
                  <InputNumber
                    min={0}
                    max={
                      r.ReplacementRequestedQty -
                      r.Replacements.reduce((n, s) => n + s.QtyPick, 0)
                    }
                    precision={0}
                    value={quantities[r.Id] ?? 0}
                    disabled={
                      selected.Status !== "OPEN" ||
                      !can("IPCS.MATERIAL_NG_ISSUE") ||
                      saving
                    }
                    onChange={(v) =>
                      setQuantities((q) => ({ ...q, [r.Id]: v ?? 0 }))
                    }
                  />
                ),
              },
            ]}
            expandable={{
              expandedRowRender: (r) => (
                <Table
                  size="small"
                  rowKey="Id"
                  dataSource={r.Replacements}
                  pagination={false}
                  columns={[
                    { title: "Qty", dataIndex: "QtyPick" },
                    { title: "Actor", dataIndex: "CreatedBy" },
                    {
                      title: "Time",
                      render: (_, s) =>
                        new Date(s.CreatedAt).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                        }),
                    },
                  ]}
                />
              ),
            }}
          />
          <Space style={{ marginTop: 12 }}>
            <Button
              type="primary"
              loading={saving}
              disabled={
                selected.Status !== "OPEN" || !can("IPCS.MATERIAL_NG_ISSUE")
              }
              onClick={() => void issue()}
            >
              Issue Replacement
            </Button>
            <Button
              disabled={
                !can("IPCS.MATERIAL_NG_CLOSE") ||
                ["CLOSED", "CANCELLED"].includes(selected.Status)
              }
              onClick={() => {
                setCloseReason("");
                setCloseAction("CLOSE");
                setClosing(true);
              }}
            >
              Close / Cancel Case
            </Button>
            <Link
              href={`/apps/traceability?poId=${encodeURIComponent(selected.ForecastId)}`}
            >
              View Traceability
            </Link>
          </Space>
        </>
      )}
      <Modal
        centered
        width={1050}
        open={open}
        title="Report Material NG"
        onCancel={() => setOpen(false)}
        onOk={() => void save()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Alert
          type="info"
          title="Material NG does not change the standard BOM or deduct rack stock again. Replacement is issued separately."
          style={{ marginBottom: 12 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item
            name="poId"
            label="Production PO"
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={(v) => void findOrders(v)}
              onChange={(v) => void selectPo(v)}
              options={orders.map((o) => ({
                value: o.PoId,
                label: `${o.PoId} — ${o.FinishGoodId}`,
              }))}
            />
          </Form.Item>
          <Space align="start">
            <Form.Item
              name="stage"
              label="Process Stage"
              rules={[{ required: true, whitespace: true }]}
            >
              <Input
                placeholder="Assembly / preparation / other"
                maxLength={100}
              />
            </Form.Item>
            <Form.Item
              name="reason"
              label="Reason"
              rules={[{ required: true, whitespace: true }]}
            >
              <Input.TextArea style={{ width: 550 }} maxLength={1000} />
            </Form.Item>
          </Space>
        </Form>
        {!snapshot && (
          <Alert
            type="warning"
            title="Select a PO with an approved BOM snapshot."
          />
        )}
        {snapshot && (
          <>
            <Tag>BOM Revision {snapshot.Revision.Revision}</Tag>
            <Space style={{ margin: "12px 0" }}>
              <Radio.Group
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                options={[
                  { value: "MATERIAL", label: "Specific Materials" },
                  { value: "SET", label: "BOM Set" },
                ]}
              />
              {mode === "SET" && (
                <>
                  <InputNumber
                    min={1}
                    precision={0}
                    value={sets}
                    onChange={(n) => setSets(n ?? 1)}
                  />
                  <Button
                    onClick={() =>
                      setLines((old) =>
                        old.map((l) => ({
                          ...l,
                          qtyNg: l.perUnit * sets,
                          qtyReplacement: l.perUnit * sets,
                        })),
                      )
                    }
                  >
                    Expand Set
                  </Button>
                </>
              )}
            </Space>
            <p>
              Review every component. Set NG and replacement to zero for
              components that remain usable.
            </p>
            <Table<DraftLine>
              size="small"
              rowKey="materialId"
              dataSource={lines}
              pagination={false}
              columns={[
                { title: "Material", dataIndex: "materialId" },
                { title: "Name", dataIndex: "name" },
                {
                  title: "NG Qty",
                  render: (_, r) => (
                    <InputNumber
                      min={0}
                      precision={0}
                      value={r.qtyNg}
                      onChange={(n) =>
                        setLines((old) =>
                          old.map((l) =>
                            l.materialId === r.materialId
                              ? {
                                  ...l,
                                  qtyNg: n ?? 0,
                                  qtyReplacement: Math.min(
                                    l.qtyReplacement,
                                    n ?? 0,
                                  ),
                                }
                              : l,
                          ),
                        )
                      }
                    />
                  ),
                },
                {
                  title: "Replacement Needed",
                  render: (_, r) => (
                    <InputNumber
                      min={0}
                      max={r.qtyNg}
                      precision={0}
                      value={r.qtyReplacement}
                      onChange={(n) =>
                        setLines((old) =>
                          old.map((l) =>
                            l.materialId === r.materialId
                              ? { ...l, qtyReplacement: n ?? 0 }
                              : l,
                          ),
                        )
                      }
                    />
                  ),
                },
              ]}
            />
          </>
        )}
      </Modal>
      <Modal
        centered
        open={closing}
        title="Close Material NG Case"
        onCancel={() => setClosing(false)}
        onOk={() => void close()}
        confirmLoading={saving}
      >
        <Radio.Group
          value={closeAction}
          onChange={(e) => setCloseAction(e.target.value)}
          options={[
            { value: "CLOSE", label: "Close remaining requirement" },
            { value: "CANCEL", label: "Cancel (no replacement issued)" },
          ]}
        />
        <Input.TextArea
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
          placeholder="Required reason"
          maxLength={1000}
        />
      </Modal>
    </Card>
  );
}
