/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Breadcrumb,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Table,
  Tabs,
  Tag,
} from "antd";
import type { TableProps } from "antd";
import { PlusOutlined, ReloadOutlined, EyeOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import type { AppDispatch, RootState } from "@/store";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import ButtonToolbar from "@/components/ButtonToolbar";
import { usePhasePermission } from "@/components/traceability/usePhasePermission";
import {
  createRevision,
  fetchRevisions,
  setRevisionQuery,
} from "@/store/features/traceability/traceabilitySlice";
import type { BomRevision, Page } from "@/store/features/traceability/types";
import { fetchFinishGood } from "@/store/features/master/finishGoodSlice";
export default function BillOfMaterialsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { message } = App.useApp();
  const { can } = usePhasePermission();
  const query = useSelector((s: RootState) => s.phaseOne.revisionQuery);
  const finishGoods = useSelector((s: RootState) => s.finishGood);
  const [data, setData] = useState<Page<BomRevision> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<BomRevision | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{
    finishGoodId: number;
    reason: string;
    importLegacy: boolean;
  }>();
  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await dispatch(fetchRevisions(query)).unwrap();
        if (alive) setData(result);
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [dispatch, query, refresh]);
  const columns: TableProps<BomRevision>["columns"] = [
    { title: "FG Part Number", render: (_, r) => r.FinishGood.PartNumber },
    { title: "FG Part Name", render: (_, r) => r.FinishGood.PartName },
    { title: "Revision", dataIndex: "Revision" },
    {
      title: "Status",
      render: (_, r) => (
        <Tag color={r.Status === "APPROVED" ? "green" : "blue"}>
          {r.FinishGood.ActiveBomRevisionId === r.Id ? "ACTIVE" : r.Status}
        </Tag>
      ),
    },
    { title: "Materials", render: (_, r) => r.Lines.length },
    { title: "Approved By", dataIndex: "ApprovedBy" },
    {
      title: "Approved At",
      render: (_, r) =>
        r.ApprovedAt
          ? new Date(r.ApprovedAt).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })
          : "-",
    },
  ];
  const create = async () => {
    try {
      const value = await form.validateFields();
      setSaving(true);
      const result = await dispatch(createRevision(value)).unwrap();
      setOpen(false);
      router.push(`/apps/master-data/bill-of-materials/${result.Id}`);
    } catch (e) {
      if (typeof e === "string") message.error(e);
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
          { title: "Master Data" },
          { title: "Bill of Materials" },
        ]}
      />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => setRefresh((v) => v + 1)}
        />
        <ButtonToolbar
          title="Create Revision"
          icon={<PlusOutlined />}
          enable={can("IPCS.BOM_REVISION_CREATE")}
          onClick={() => {
            form.resetFields();
            setOpen(true);
            void dispatch(fetchFinishGood({ limit: 50 }));
          }}
        />
        <ButtonToolbar
          title="Detail"
          icon={<EyeOutlined />}
          enable={Boolean(selected)}
          onClick={() =>
            selected &&
            router.push(`/apps/master-data/bill-of-materials/${selected.Id}`)
          }
        />
      </ToolbarWrapper>
      <Tabs
        activeKey={
          query.active === "true" ? "ACTIVE" : (query.status ?? "HISTORY")
        }
        onChange={(key) => {
          setSelected(null);
          dispatch(
            setRevisionQuery({
              page: 1,
              limit: 20,
              search: query.search,
              ...(key === "ACTIVE"
                ? { active: "true" }
                : key === "HISTORY"
                  ? {}
                  : { status: key }),
            }),
          );
        }}
        items={[
          { key: "ACTIVE", label: "Active BOM" },
          { key: "DRAFT", label: "Drafts" },
          { key: "SUBMITTED", label: "Pending Approval" },
          { key: "HISTORY", label: "History" },
        ]}
      />
      <Input.Search
        placeholder="Search finish good"
        defaultValue={query.search}
        allowClear
        onSearch={(search) =>
          dispatch(setRevisionQuery({ ...query, search, page: 1 }))
        }
        style={{ maxWidth: 380, marginBottom: 12 }}
      />
      {error && <Alert type="error" title={error} showIcon />}
      <Table<BomRevision>
        size="small"
        className="small-table"
        rowKey="Id"
        columns={columns}
        dataSource={data?.data ?? []}
        loading={loading}
        scroll={{ x: "max-content" }}
        rowSelection={{
          type: "radio",
          selectedRowKeys: selected ? [selected.Id] : [],
          onChange: (_, rows) => setSelected(rows[0] ?? null),
        }}
        onRow={(row) => ({
          onDoubleClick: () =>
            router.push(`/apps/master-data/bill-of-materials/${row.Id}`),
        })}
        pagination={{
          current: query.page,
          pageSize: query.limit,
          total: data?.meta.totalItems ?? 0,
          onChange: (page, limit) =>
            dispatch(setRevisionQuery({ ...query, page, limit })),
        }}
      />
      <Modal
        centered
        open={open}
        title="Create BOM Revision"
        onCancel={() => setOpen(false)}
        onOk={() => void create()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="finishGoodId"
            label="Finish Good"
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={(search) =>
                void dispatch(fetchFinishGood({ search, limit: 50 }))
              }
              loading={finishGoods.loading}
              options={finishGoods.data.map((f) => ({
                value: f.Id,
                label: `${f.PartNumber} � ${f.PartName}`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Change Reason"
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea maxLength={1000} />
          </Form.Item>
          <Form.Item name="importLegacy" valuePropName="checked">
            <Checkbox>Import current BOM as an initial baseline draft</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
