/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FullscreenOutlined,
  LeftOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RightOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { AppDispatch, RootState } from "@/store";
import {
  fetchProductionDashboard,
  type ProductionStageStatus,
} from "@/store/features/dashboard/productionDashboardSlice";
import styles from "./dashboard.module.css";
import AutoScrollOrders from "./AutoScrollOrders";
import ProductionReleaseEmpty from "./ProductionReleaseEmpty";
import ProcessIllustration, { type ProcessKind } from "./ProcessIllustration";

const number = (value: number) => value.toLocaleString("en-US");
const percentage = (done: number, total: number) =>
  total > 0 ? Math.max(0, (done / total) * 100) : 0;
const time = (value: string | number) =>
  new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Jakarta",
    hour12: false,
  });
const date = (value: string | number) =>
  new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
  });
const statusNames: Record<ProductionStageStatus, string> = {
  COMPLETE: "Complete",
  IN_PROGRESS: "In progress",
  PENDING: "Not started",
  UNAVAILABLE: "Needs review",
};
const pageSize = 3;

function usePages(length: number, pageSize: number, auto: boolean) {
  const [index, setIndex] = useState(0);
  const pages = Math.max(1, Math.ceil(length / pageSize));
  useEffect(() => {
    if (!auto || pages <= 1) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % pages),
      12000,
    );
    return () => window.clearInterval(timer);
  }, [auto, pages]);
  return {
    page: index % pages,
    pages,
    previous: () => setIndex((value) => ((value % pages) + pages - 1) % pages),
    next: () => setIndex((value) => (value + 1) % pages),
    reset: () => setIndex(0),
  };
}

function Pager({
  label,
  page,
  pages,
  previous,
  next,
}: {
  label: string;
  page: number;
  pages: number;
  previous: () => void;
  next: () => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className={styles.pager}>
      <button aria-label={`Previous ${label} page`} onClick={previous}>
        <LeftOutlined />
      </button>
      <span>
        {page + 1} / {pages}
      </span>
      <button aria-label={`Next ${label} page`} onClick={next}>
        <RightOutlined />
      </button>
    </div>
  );
}

function StageDot({
  name,
  status,
}: {
  name: string;
  status: ProductionStageStatus;
}) {
  return (
    <span
      className={`${styles.stageDot} ${styles[status]}`}
      title={`${name}: ${statusNames[status]}`}
      aria-label={`${name}: ${statusNames[status]}`}
    >
      {status === "COMPLETE" ? "✓" : status === "UNAVAILABLE" ? "!" : "•"}
    </span>
  );
}

export default function ProductionDashboard() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector(
    (state: RootState) => state.productionDashboard,
  );
  const [releaseId, setReleaseId] = useState("all");
  const [autoPages, setAutoPages] = useState(true);
  const [clock, setClock] = useState(0);
  useEffect(() => {
    void dispatch(fetchProductionDashboard());
    const poll = window.setInterval(() => {
      void dispatch(fetchProductionDashboard());
    }, 20000);
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [dispatch]);
  const selectedRelease = data?.releases.find(
    (release) => release.id === releaseId,
  );
  const effectiveReleaseId = selectedRelease?.id ?? "all";
  const metrics = selectedRelease?.metrics ?? data?.metrics;
  const hourly = selectedRelease?.hourly ?? data?.hourly ?? [];
  const scope = useMemo(
    () => (selectedRelease ? [selectedRelease] : (data?.releases ?? [])),
    [selectedRelease, data],
  );
  const cycles = useMemo(
    () =>
      scope.flatMap((release) =>
        release.cycles.map((cycle) => ({
          ...cycle,
          releaseId: release.id,
          releaseNumber: release.releaseNumber,
        })),
      ),
    [scope],
  );
  const orders = useMemo(
    () =>
      scope
        .flatMap((release) =>
          release.orders.map((order) => ({
            ...order,
            releaseId: release.id,
            releaseNumber: release.releaseNumber,
          })),
        )
        .sort(
          (a, b) =>
            Number(b.issues.length > 0) - Number(a.issues.length > 0) ||
            Number(b.overdue) - Number(a.overdue) ||
            Number(a.deliveryComplete) - Number(b.deliveryComplete) ||
            a.deliveryDate.localeCompare(b.deliveryDate) ||
            a.period - b.period ||
            a.poId.localeCompare(b.poId),
        ),
    [scope],
  );
  const cyclePages = usePages(cycles.length, pageSize, autoPages);
  const stale =
    Boolean(error) ||
    Boolean(data && clock && clock - Date.parse(data.generatedAt) > 60000);
  const ratio = metrics ? percentage(metrics.deliveredQty, metrics.planQty) : 0;
  const notStartedPo = metrics
    ? Math.max(0, metrics.poCount - metrics.completedPo - metrics.partialPo)
    : 0;
  const currentCycles = cycles.filter((cycle) => cycle.status === "CURRENT");
  const focusOrder =
    orders.find((order) => order.issues.length > 0 || order.overdue) ??
    orders.find((order) => !order.deliveryComplete && !order.cycleBlocked);
  const fullscreen = () => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => undefined);
    else
      void document.documentElement.requestFullscreen().catch(() => undefined);
  };

  return (
    <main
      className={styles.dashboard}
      data-motion={autoPages && !stale ? "running" : "paused"}
      aria-label="ANSEI production control dashboard"
    >
      <header className={styles.header}>
        <div className={styles.brand}>
          <div>
            <h1>
              ANSEI <span>Production Status</span>
            </h1>
            <p>
              Active Releases <span>•</span> GENBA
            </p>
          </div>
        </div>
        <div className={styles.headerControls}>
          <select
            aria-label="Production release"
            value={effectiveReleaseId}
            onChange={(event) => {
              setReleaseId(event.target.value);
              cyclePages.reset();
            }}
          >
            <option value="all">
              All Active Releases ({data?.releases.length ?? 0})
            </option>
            {data?.releases.map((release) => (
              <option key={release.id} value={release.id}>
                {release.releaseNumber}
              </option>
            ))}
          </select>
          <button
            onClick={() => setAutoPages((value) => !value)}
            aria-label={
              autoPages ? "Pause automatic motion" : "Resume automatic motion"
            }
            title={
              autoPages ? "Pause automatic motion" : "Resume automatic motion"
            }
          >
            {autoPages ? <PauseOutlined /> : <PlayCircleOutlined />}
            <span className={styles.controlLabel}>
              {autoPages ? "Auto Motion" : "Paused"}
            </span>
          </button>
          <button
            onClick={() => void dispatch(fetchProductionDashboard())}
            disabled={loading}
            aria-label="Refresh production data"
            title="Refresh"
          >
            <ReloadOutlined spin={loading} />
          </button>
          <button
            onClick={fullscreen}
            aria-label="Toggle fullscreen"
            title="Fullscreen"
          >
            <FullscreenOutlined />
          </button>
          <div className={styles.clock}>
            <strong>{clock ? time(clock) : "--:--:--"}</strong>
            <span>{clock ? date(clock) : "GENBA"} · WIB</span>
          </div>
        </div>
      </header>

      {!data || !metrics ? (
        <div className={styles.screenState} role="status">
          {error ? <WarningOutlined /> : <ReloadOutlined spin />}
          <h2>
            {error
              ? "Production Data Unavailable"
              : "Loading Active Production"}
          </h2>
          <p>{error ?? "Preparing PO, cycle and process metrics…"}</p>
          {error && (
            <button onClick={() => void dispatch(fetchProductionDashboard())}>
              Retry Now
            </button>
          )}
        </div>
      ) : data.releases.length === 0 ? (
        <div className={styles.screenState} role="status">
          <ProductionReleaseEmpty />
          {stale && (
            <p className={styles.warningText}>
              Connection delayed · last update {time(data.generatedAt)}
            </p>
          )}
        </div>
      ) : (
        <>
          <section className={styles.kpis} aria-label="Production summary">
            <article className={`${styles.kpi} ${styles.kpiTeal}`}>
              <p>
                Delivered / PO Plan <span>pcs</span>
              </p>
              <div className={styles.kpiValue}>
                {number(metrics.deliveredQty)}{" "}
                <span>/ {number(metrics.planQty)}</span>
              </div>
              <div className={styles.miniTrack}>
                <span
                  style={{
                    width: `${Math.min(100, ratio)}%`,
                  }}
                />
              </div>
              <small>
                {ratio.toFixed(1)}% delivered{" "}
                <b>{number(metrics.remainingQty)} remaining</b>
              </small>
            </article>
            <article className={styles.kpi}>
              <p>
                PO Fully Delivered <span>orders</span>
              </p>
              <div className={styles.kpiValue}>
                {number(metrics.completedPo)}{" "}
                <span>/ {number(metrics.poCount)}</span>
              </div>
              <small>
                {number(metrics.partialPo)} partially delivered{" "}
                <b>{number(notStartedPo)} not shipped</b>
              </small>
            </article>
            <article className={styles.kpi}>
              <p>
                Recorded FG Output <span>pcs</span>
              </p>
              <div className={styles.kpiValue}>
                {number(metrics.producedQty)}
              </div>
              <small>
                {percentage(metrics.producedQty, metrics.planQty).toFixed(1)}%
                of PO plan <b>Production ledger</b>
              </small>
            </article>
            <article className={styles.kpi}>
              <p>
                Awaiting Delivery <span>pcs</span>
              </p>
              <div className={styles.kpiValue}>
                {number(metrics.awaitingDeliveryQty)}
              </div>
              <small>
                {number(metrics.awaitingDeliveryLabels)} Validated Box{" "}
                <b
                  className={metrics.cycleBlockedQty ? styles.warningText : ""}
                >
                  {number(metrics.cycleBlockedQty)} cycle-blocked
                </b>
              </small>
            </article>
            <article
              className={`${styles.kpi} ${metrics.overduePo ? styles.kpiRed : ""}`}
            >
              <p>
                Overdue PO <span>orders</span>
              </p>
              <div className={styles.kpiValue}>{number(metrics.overduePo)}</div>
              <small>
                Delivery date before today{" "}
                <b>{number(metrics.overdueQty)} pcs outstanding</b>
              </small>
            </article>
          </section>

          <section className={styles.middleGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Delivery Attainment</h2>
                  <p>Actual shipments against PO plan</p>
                </div>
                <span className={styles.pill}>
                  {metrics.releaseCount} active
                </span>
              </div>
              <div className={styles.attainment}>
                <div
                  className={styles.donut}
                  role="img"
                  aria-label={`${ratio.toFixed(1)} percent of planned quantity delivered`}
                >
                  <svg viewBox="0 0 120 120">
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      className={styles.donutTrack}
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      className={styles.donutFill}
                      strokeDasharray={`${Math.min(100, ratio) * Math.PI} ${100 * Math.PI}`}
                    />
                  </svg>
                  <div>
                    <strong>
                      {ratio.toFixed(1)}
                      <small>%</small>
                    </strong>
                    <span>Delivered</span>
                  </div>
                </div>
                <div className={styles.poBreakdown}>
                  <div>
                    <i className={styles.tealDot} />
                    <span>Complete PO</span>
                    <strong>{number(metrics.completedPo)}</strong>
                  </div>
                  <div>
                    <i className={styles.blueDot} />
                    <span>Partial Delivery</span>
                    <strong>{number(metrics.partialPo)}</strong>
                  </div>
                  <div>
                    <i className={styles.mutedDot} />
                    <span>Not Shipped</span>
                    <strong>{number(notStartedPo)}</strong>
                  </div>
                  <div className={styles.labelTotal}>
                    <span>Box Delivered</span>
                    <b>
                      {number(metrics.deliveredLabels)} /{" "}
                      {number(metrics.labelCount)}
                    </b>
                  </div>
                </div>
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Process Completion</h2>
                  <p>Completed / Total</p>
                </div>
              </div>
              <div className={styles.processGrid}>
                {[
                  {
                    name: "Picking",
                    kind: "picking" as ProcessKind,
                    active: metrics.shoppingStartedPo > 0,
                    done: metrics.shoppingCompletePo,
                    total: metrics.poCount,
                    unit: "PO ready",
                    note: `${metrics.shoppingStartedPo} PO in progress`,
                    color: "var(--blue)",
                    tint: "var(--progress-bg)",
                  },
                  {
                    name: "Assembly",
                    kind: "assembly" as ProcessKind,
                    active: metrics.assemblyRunning > 0,
                    done: metrics.assemblyComplete,
                    total: metrics.assemblyLabels,
                    unit: "Box Done",
                    note: `${metrics.assemblyRunning} running · ${metrics.directFlowPo} direct PO`,
                    color: "var(--assembly)",
                    tint: "var(--assembly-bg)",
                  },
                  {
                    name: "Inspection",
                    kind: "pokayoke" as ProcessKind,
                    active:
                      metrics.validatedLabels > 0 &&
                      metrics.validatedLabels < metrics.labelCount,
                    done: metrics.validatedLabels,
                    total: metrics.labelCount,
                    unit: "Box Validated",
                    note: `${number(metrics.validatedQty)} pcs validated`,
                    color: "var(--amber)",
                    tint: "var(--warning-bg)",
                  },
                  {
                    name: "Delivery",
                    kind: "delivery" as ProcessKind,
                    active:
                      metrics.deliveredLabels > 0 &&
                      metrics.deliveredLabels < metrics.labelCount,
                    done: metrics.deliveredLabels,
                    total: metrics.labelCount,
                    unit: "Box Shipped",
                    note: `${number(metrics.deliveredQty)} pcs shipped`,
                    color: "var(--teal)",
                    tint: "var(--success-bg)",
                  },
                ].map((process) => (
                  <div
                    className={styles.process}
                    key={process.name}
                    style={
                      {
                        "--process-color": process.color,
                        "--process-tint": process.tint,
                      } as CSSProperties
                    }
                  >
                    <div className={styles.processTitle}>
                      <h3>{process.name}</h3>
                    </div>
                    <div className={styles.processVisual}>
                      <ProcessIllustration
                        kind={process.kind}
                        active={process.active}
                      />
                      <div className={styles.processValue}>
                        {process.total
                          ? percentage(process.done, process.total).toFixed(0)
                          : "—"}
                        <small>{process.total ? "%" : ""}</small>
                      </div>
                    </div>
                    <div className={styles.processTrack}>
                      <span
                        style={{
                          width: `${Math.min(100, percentage(process.done, process.total))}%`,
                          background: process.color,
                        }}
                      />
                    </div>
                    <b>
                      {number(process.done)} / {number(process.total)}
                    </b>
                    <span>{process.unit}</span>
                    <small>{process.note}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Hourly Output / Delivery</h2>
                  <p>Active Releases only · pcs / hour · WIB</p>
                </div>
              </div>
              <div className={styles.chartLegend}>
                <span>
                  <i className={styles.blueDot} />
                  FG output
                </span>
                <span>
                  <i className={styles.tealDot} />
                  Delivered
                </span>
              </div>
              <div className={styles.trendChart}>
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  initialDimension={{
                    width: 400,
                    height: 180,
                  }}
                >
                  <LineChart
                    data={hourly}
                    margin={{
                      top: 8,
                      right: 8,
                      bottom: 0,
                      left: -10,
                    }}
                  >
                    <CartesianGrid
                      stroke="var(--border)"
                      vertical={false}
                      strokeDasharray="3 4"
                    />
                    <XAxis
                      dataKey="hour"
                      tick={{
                        fill: "var(--muted)",
                        fontSize: "var(--chart-font)",
                        fontWeight: 600,
                      }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={26}
                    />
                    <YAxis
                      tick={{
                        fill: "var(--muted)",
                        fontSize: "var(--chart-font)",
                        fontWeight: 600,
                      }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                        borderRadius: 2,
                        color: "var(--text)",
                      }}
                    />
                    <Line
                      name="FG output"
                      type="linear"
                      dataKey="producedQty"
                      stroke="var(--blue)"
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      name="Delivered"
                      type="linear"
                      dataKey="deliveredQty"
                      stroke="var(--teal)"
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className={styles.bottomGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Delivery Cycles</h2>
                  <p>
                    {metrics.cycleComplete} complete · {currentCycles.length}{" "}
                    current · {metrics.cycleBlocked} blocked
                  </p>
                </div>
                <Pager label="cycle" {...cyclePages} />
              </div>
              <div className={styles.cycleList}>
                {cycles
                  .slice(
                    cyclePages.page * pageSize,
                    (cyclePages.page + 1) * pageSize,
                  )
                  .map((cycle) => (
                    <div
                      key={`${cycle.releaseId}-${cycle.period}`}
                      className={`${styles.cycleRow} ${styles[`cycle${cycle.status}`]}`}
                    >
                      <span className={styles.cycleNumber}>
                        C<span>{cycle.period}</span>
                      </span>
                      <div className={styles.cycleBody}>
                        <div className={styles.rowTop}>
                          <strong title={cycle.releaseNumber}>
                            {cycle.releaseNumber}
                          </strong>
                          <span className={styles.cycleStatus}>
                            {cycle.status === "COMPLETE"
                              ? "Complete"
                              : cycle.status === "CURRENT"
                                ? "Current"
                                : `Wait C${cycle.blockedByPeriod}`}
                          </span>
                        </div>
                        <div className={styles.barTrack}>
                          <span
                            style={{
                              width: `${Math.min(100, percentage(cycle.deliveredQty, cycle.planQty))}%`,
                            }}
                          />
                        </div>
                        <div className={styles.rowBottom}>
                          <span>
                            {number(cycle.deliveredQty)} /{" "}
                            {number(cycle.planQty)} pcs
                          </span>
                          <span>
                            {cycle.completedPo}/{cycle.poCount} PO ·{" "}
                            {cycle.deliveredLabels}/{cycle.labels} Box
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                {!cycles.length && (
                  <p className={styles.emptyText}>No PO cycles assigned.</p>
                )}
              </div>
              <p className={styles.panelFootnote}>
                Each release advances only after all PO boxes in its earlier
                cycle are delivered.
              </p>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>PO Plan Vs Delivered</h2>
                  <p>Exceptions and overdue PO shown first</p>
                </div>
                <span className={styles.pill}>{orders.length} PO</span>
              </div>
              <div className={styles.orderColumns}>
                <span>PO / Part</span>
                <span>Delivered / Plan</span>
                <span className={styles.stageColumnHeading}>
                  <span>MAT</span>
                  <span>FG</span>
                  <span>INS</span>
                  <span>DEL</span>
                </span>
              </div>
              <AutoScrollOrders
                key={effectiveReleaseId}
                count={orders.length}
                running={autoPages && !stale}
              >
                {orders.map((order) => (
                  <div
                    key={`${order.releaseId}-${order.poId}`}
                    className={styles.orderRow}
                  >
                    <div className={styles.orderIdentity}>
                      <strong title={`${order.poId} • ${order.releaseNumber}`}>
                        {order.poId}
                      </strong>
                      <span title={`${order.partNumber} — ${order.partName}`}>
                        {order.partNumber}
                      </span>
                      <small>
                        C{order.period} · {date(order.deliveryDate)}{" "}
                        {order.issues.length ? (
                          <b className={styles.warningText}>Check</b>
                        ) : order.overdue ? (
                          <b className={styles.dangerText}>Late</b>
                        ) : null}
                      </small>
                    </div>
                    <div className={styles.orderProgress}>
                      <div>
                        <strong>
                          {number(order.deliveredQty)}{" "}
                          <span>/ {number(order.planQty)}</span>
                        </strong>
                        <small>{number(order.remainingQty)} left</small>
                      </div>
                      <div className={styles.barTrack}>
                        <span
                          style={{
                            width: `${Math.min(100, percentage(order.deliveredQty, order.planQty))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className={styles.stageDots}>
                      <StageDot
                        name="Material picking"
                        status={order.shoppingStatus}
                      />
                      <StageDot
                        name="FG output"
                        status={order.productionStatus}
                      />
                      <StageDot
                        name="Inspection"
                        status={order.pokayokeStatus}
                      />
                      <StageDot
                        name="Delivery"
                        status={
                          order.deliveryComplete
                            ? "COMPLETE"
                            : order.deliveredQty > 0
                              ? "IN_PROGRESS"
                              : "PENDING"
                        }
                      />
                    </div>
                  </div>
                ))}
                {!orders.length && (
                  <p className={styles.emptyText}>
                    No PO Assigned to this release.
                  </p>
                )}
              </AutoScrollOrders>
              <div className={styles.stageLegend}>
                <span>
                  <i className={styles.tealDot} />
                  Complete
                </span>
                <span>
                  <i className={styles.blueDot} />
                  In progress
                </span>
                <span>
                  <i className={styles.mutedDot} />
                  Pending
                </span>
                <span>
                  <i className={styles.amberDot} />
                  Review
                </span>
              </div>
            </article>

            <article className={`${styles.panel} ${styles.attentionPanel}`}>
              <div className={styles.panelHeading}>
                <div>
                  <h2>Leader Attention</h2>
                  <p>Open work & exceptions</p>
                </div>
              </div>
              <div className={styles.attentionStats}>
                <div>
                  <span>Material Picking Open</span>
                  <b>
                    {number(metrics.poCount - metrics.shoppingCompletePo)}{" "}
                    <small>PO</small>
                  </b>
                </div>
                <div>
                  <span>Assembly Running</span>
                  <b>
                    {number(metrics.assemblyRunning)} <small>Box</small>
                  </b>
                </div>
                <div>
                  <span>Open Quality Findings</span>
                  <b className={metrics.openFindings ? styles.warningText : ""}>
                    {number(metrics.openFindings)}
                  </b>
                </div>
                <div>
                  <span>Waiting Part Change</span>
                  <b
                    className={
                      metrics.waitingPartChange ? styles.warningText : ""
                    }
                  >
                    {number(metrics.waitingPartChange)}
                  </b>
                </div>
                <div>
                  <span>Data Needs Review</span>
                  <b className={metrics.issuePo ? styles.warningText : ""}>
                    {number(metrics.issuePo)} <small>PO</small>
                  </b>
                </div>
              </div>
              <div className={styles.focusBox}>
                <span>
                  {focusOrder?.issues.length
                    ? "Check This PO"
                    : focusOrder?.overdue
                      ? "Overdue Priority"
                      : focusOrder
                        ? "Current Cycle"
                        : orders.length
                          ? "Delivery Complete"
                          : "No PO Planned"}
                </span>
                <strong title={focusOrder?.poId}>
                  {focusOrder?.poId ??
                    (orders.length ? "All PO Delivered" : "No PO Assigned")}
                </strong>
                <p>
                  {focusOrder
                    ? (focusOrder.issues[0] ??
                      `${focusOrder.releaseNumber} · Cycle ${focusOrder.period} · ${number(focusOrder.remainingQty)} pcs to deliver`)
                    : orders.length
                      ? "Review release closure in the production application."
                      : "Assign PO to this release in the production application."}
                </p>
              </div>
            </article>
          </section>
        </>
      )}

      <footer
        className={`${styles.footer} ${stale ? styles.footerStale : ""}`}
        aria-live="polite"
      >
        <span className={styles.connection}>
          <i />
          {stale ? "Data Delayed" : data ? "Live" : "Connecting"}{" "}
          <span>
            {data
              ? `Updated ${time(data.generatedAt)} WIB`
              : "Waiting for production data"}
          </span>
        </span>
        {data?.inventoryHolds.length ? (
          <strong className={styles.warningText}>
            Inventory Count Active ·{" "}
            {data.inventoryHolds
              .map((item) => item.replaceAll("_", " "))
              .join(" / ")}{" "}
            transactions on hold
          </strong>
        ) : (
          <span className={styles.footerDescription}>
            {stale
              ? "Showing the last successful update · retrying automatically"
              : "Released Orders Only · Refresh 20s · Cycles 12s · PO Auto Scroll"}
          </span>
        )}
        <span className={styles.footerBrand}>ANSEI · VUTEQ INDONESIA</span>
      </footer>
    </main>
  );
}
