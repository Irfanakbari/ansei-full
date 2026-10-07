/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Alert, Select, Spin, Table, Tabs } from "antd";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/store";
import {
  fetchBomSnapshots,
  fetchTrace,
  fetchTraceEvents,
} from "@/store/features/traceability/traceabilitySlice";
import type {
  BomSnapshot,
  TraceData,
  TraceEvent,
} from "@/store/features/traceability/types";
import SnapshotTable from "./SnapshotTable";
import MaterialUsageTable from "./MaterialUsageTable";
import { usePhasePermission } from "./usePhasePermission";

interface ReleaseBomPanelProps {
  releaseId: string;
  attachments?: ReactNode;
  attachmentsCount?: number;
}

export default function ReleaseBomPanel({
  releaseId,
  attachments,
  attachmentsCount = 0,
}: ReleaseBomPanelProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { can } = usePhasePermission();
  const canTrace = can("IPCS.TRACEABILITY_READ");
  const [snapshots, setSnapshots] = useState<BomSnapshot[]>([]);
  const [selected, setSelected] = useState("");
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    void (async () => {
      setLoading(true);
      try {
        const list = await dispatch(fetchBomSnapshots(releaseId)).unwrap();
        if (live) {
          setSnapshots(list);
          setSelected(list[0]?.Id ?? "");
          setError("");
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
  }, [dispatch, releaseId]);
  const snapshot = snapshots.find((s) => s.Id === selected) ?? null;
  useEffect(() => {
    let live = true;
    if (snapshot && canTrace)
      void (async () => {
        try {
          const [d, e] = await Promise.all([
            dispatch(fetchTrace(snapshot.ProductionDemandId)).unwrap(),
            dispatch(
              fetchTraceEvents({ poId: snapshot.ProductionDemandId, page: 1 }),
            ).unwrap(),
          ]);
          if (live) {
            setTrace(d);
            setEvents(e.data);
          }
        } catch (e) {
          if (live) setError(String(e));
        }
      })();
    return () => {
      live = false;
    };
  }, [dispatch, snapshot, canTrace]);
  return (
    <div style={{ minWidth: 0 }}>
      {error && <Alert type="error" title={error} />}
      <Spin spinning={loading}>
        <Select
          style={{ width: "100%", marginBottom: 12 }}
          value={selected || undefined}
          placeholder="PO / BOM snapshot"
          onChange={setSelected}
          options={snapshots.map((s) => ({
            value: s.Id,
            label: `${s.ProductionDemandId} — BOM ${s.Revision.Revision} / snapshot ${s.Version}`,
          }))}
        />
        <Tabs
          items={[
            {
              key: "bom",
              label: "PO & BOM",
              children: <SnapshotTable snapshot={snapshot} />,
            },
            ...(canTrace && trace
              ? [
                  {
                    key: "materials",
                    label: "Materials",
                    children: <MaterialUsageTable data={trace.materials} />,
                  },
                  {
                    key: "history",
                    label: "History",
                    children: (
                      <>
                        <Table
                          size="small"
                          rowKey="Id"
                          dataSource={events}
                          columns={[
                            {
                              title: "Time",
                              render: (_: unknown, r: TraceEvent) =>
                                new Date(r.CreatedAt).toLocaleString("id-ID", {
                                  timeZone: "Asia/Jakarta",
                                }),
                            },
                            { title: "Activity", dataIndex: "Type" },
                            { title: "Actor", dataIndex: "Actor" },
                          ]}
                        />
                        <Link
                          href={`/apps/traceability?poId=${encodeURIComponent(trace.forecast.PoId)}`}
                        >
                          Full traceability and labels
                        </Link>
                      </>
                    ),
                  },
                ]
              : []),
            ...(attachments
              ? [
                  {
                    key: "attachments",
                    label: `Attachments (${attachmentsCount})`,
                    children: attachments,
                  },
                ]
              : []),
          ]}
        />
      </Spin>
    </div>
  );
}
