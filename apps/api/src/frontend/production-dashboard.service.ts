/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getDeliveryProgress } from '../common/helpers/delivery-progress.helper';
import {
  DashboardStageStatus,
  ProductionDashboardCycle,
  ProductionDashboardHour,
  ProductionDashboardMetrics,
  ProductionDashboardOrder,
  ProductionDashboardRelease,
  ProductionDashboardResponse,
} from './entities/production-dashboard.entity';

// Explicit selection: this public display never reads operator identity, suppliers, or audit payloads.
export const productionDashboardSelect = {
  Id: true,
  ReleaseNumber: true,
  PlanDate: true,
  ProductionFindings: {
    where: {
      DeletedAt: null,
      Status: { in: ['PENDING', 'WAITING_PART_CHANGE'] },
    },
    select: { Status: true },
  },
  Forecasts: {
    orderBy: [
      { DeliveryPeriod: 'asc' },
      { DeliveryDate: 'asc' },
      { PoId: 'asc' },
    ],
    select: {
      PoId: true,
      Qty: true,
      FinishGoodId: true,
      DeliveryPeriod: true,
      DeliveryDate: true,
      PartData: { select: { PartName: true } },
      BomSnapshots: {
        orderBy: [{ CreatedAt: 'desc' }, { Version: 'desc' }],
        select: {
          ReleaseId: true,
          TargetQty: true,
          Lines: {
            select: {
              Id: true,
              RequiredQty: true,
              Material: { select: { PartNumber: true } },
            },
          },
        },
      },
      Shopping: {
        where: { Purpose: 'STANDARD' },
        select: { Id: true, QtyPick: true, MaterialId: true },
      },
      LabelData: {
        select: {
          LabelNumber: true,
          QtyThisBox: true,
          Scanned: true,
          RequiresAssembly: true,
          AssemblySessions: {
            where: { Status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
            select: { Id: true, Status: true },
          },
        },
      },
      DeliveryHistory: {
        select: {
          ForecastId: true,
          LabelDataId: true,
          Qty: true,
          CreatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.ProductionReleaseSelect;

export type DashboardReleaseSource = Prisma.ProductionReleaseGetPayload<{
  select: typeof productionDashboardSelect;
}>;
type OutputRow = {
  ReferenceDoc: string | null;
  FinishGoodId: string | null;
  QtyIn: number;
  TransactionDate: Date;
};
const localTime = (date: Date) =>
  new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString();

export function emptyDashboardMetrics(): ProductionDashboardMetrics {
  return {
    releaseCount: 0,
    poCount: 0,
    completedPo: 0,
    partialPo: 0,
    planQty: 0,
    producedQty: 0,
    deliveredQty: 0,
    remainingQty: 0,
    labelCount: 0,
    deliveredLabels: 0,
    validatedLabels: 0,
    validatedQty: 0,
    awaitingDeliveryQty: 0,
    awaitingDeliveryLabels: 0,
    cycleBlockedQty: 0,
    shoppingCompletePo: 0,
    shoppingStartedPo: 0,
    assemblyLabels: 0,
    assemblyComplete: 0,
    assemblyRunning: 0,
    directFlowPo: 0,
    overduePo: 0,
    overdueQty: 0,
    issuePo: 0,
    openFindings: 0,
    waitingPartChange: 0,
    cycleCount: 0,
    cycleComplete: 0,
    cycleBlocked: 0,
  };
}

function emptyHours(now: Date): ProductionDashboardHour[] {
  const lastHour = Number(localTime(now).slice(11, 13));
  return Array.from({ length: lastHour + 1 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    producedQty: 0,
    deliveredQty: 0,
  }));
}

function stage(done: number, total: number): DashboardStageStatus {
  if (total <= 0) return 'UNAVAILABLE';
  if (done >= total) return 'COMPLETE';
  return done > 0 ? 'IN_PROGRESS' : 'PENDING';
}

export function buildDashboardRelease(
  release: DashboardReleaseSource,
  outputRows: OutputRow[],
  now: Date,
): ProductionDashboardRelease {
  const metrics = emptyDashboardMetrics();
  metrics.releaseCount = 1;
  metrics.openFindings = release.ProductionFindings.length;
  metrics.waitingPartChange = release.ProductionFindings.filter(
    (item) => item.Status === 'WAITING_PART_CHANGE',
  ).length;
  const hourly = emptyHours(now);
  const today = localTime(now).slice(0, 10);
  const addHour = (
    date: Date,
    key: 'producedQty' | 'deliveredQty',
    qty: number,
  ) => {
    const stamp = localTime(date);
    if (stamp.slice(0, 10) !== today) return;
    const hour = hourly[Number(stamp.slice(11, 13))];
    if (hour) hour[key] += qty;
  };
  const outputByReference = new Map<string, OutputRow[]>();
  for (const row of outputRows) {
    if (!row.ReferenceDoc) continue;
    const rows = outputByReference.get(row.ReferenceDoc) ?? [];
    rows.push(row);
    outputByReference.set(row.ReferenceDoc, rows);
  }
  const orders: ProductionDashboardOrder[] = release.Forecasts.map(
    (forecast) => {
      const issues: string[] = [];
      const snapshot = forecast.BomSnapshots.find(
        (item) => item.ReleaseId === release.Id,
      );
      const picks = new Map<string, number>();
      for (const pick of forecast.Shopping)
        picks.set(
          pick.MaterialId,
          (picks.get(pick.MaterialId) ?? 0) + pick.QtyPick,
        );
      const requirements = snapshot?.Lines ?? [];
      const pickedLines = requirements.filter(
        (line) =>
          (picks.get(line.Material.PartNumber) ?? 0) >= line.RequiredQty &&
          line.RequiredQty > 0,
      ).length;
      const shoppingStatus =
        !snapshot ||
        snapshot.TargetQty !== forecast.Qty ||
        requirements.length === 0
          ? 'UNAVAILABLE'
          : pickedLines === requirements.length
            ? 'COMPLETE'
            : forecast.Shopping.some((pick) => pick.QtyPick > 0)
              ? 'IN_PROGRESS'
              : 'PENDING';
      if (shoppingStatus === 'UNAVAILABLE')
        issues.push('Released BOM snapshot needs review');
      if (
        !Number.isInteger(forecast.DeliveryPeriod) ||
        forecast.DeliveryPeriod < 1
      )
        issues.push('Invalid delivery period');

      const productionRefs = new Set(
        forecast.Shopping.map((pick) => `PROD-${pick.Id}`),
      );
      const assemblyLabels = forecast.LabelData.filter(
        (label) => label.RequiresAssembly === true,
      );
      for (const label of forecast.LabelData) {
        for (const session of label.AssemblySessions) {
          if (session.Status === 'COMPLETED')
            productionRefs.add(`ASSY-${session.Id}`);
        }
      }
      const outputs = [...productionRefs]
        .flatMap((ref) => outputByReference.get(ref) ?? [])
        .filter((row) => row.FinishGoodId === forecast.FinishGoodId);
      const producedQty = outputs.reduce((sum, row) => sum + row.QtyIn, 0);
      outputs.forEach((row) =>
        addHour(row.TransactionDate, 'producedQty', row.QtyIn),
      );
      if (producedQty > forecast.Qty) issues.push('FG output exceeds PO plan');
      const delivery = getDeliveryProgress(forecast);
      if (!delivery.labelSetupValid)
        issues.push('Delivery labels do not match PO plan');
      if (!delivery.recordsValid) issues.push('Delivery records need review');
      if (delivery.historyQty > producedQty)
        issues.push('Delivered quantity exceeds recorded FG output');
      forecast.DeliveryHistory.forEach((row) =>
        addHour(row.CreatedAt, 'deliveredQty', row.Qty),
      );
      const deliveredNumbers = new Set(
        forecast.DeliveryHistory.map((item) => item.LabelDataId),
      );
      const validated = forecast.LabelData.filter((label) => label.Scanned);
      const awaiting = validated.filter(
        (label) => !deliveredNumbers.has(label.LabelNumber),
      );
      const awaitingDeliveryQty = awaiting.reduce(
        (sum, label) => sum + label.QtyThisBox,
        0,
      );
      const remainingQty = Math.max(0, forecast.Qty - delivery.historyQty);
      const overdue =
        !delivery.complete &&
        localTime(forecast.DeliveryDate).slice(0, 10) < today;
      metrics.poCount++;
      metrics.planQty += forecast.Qty;
      metrics.producedQty += producedQty;
      metrics.deliveredQty += delivery.historyQty;
      metrics.remainingQty += remainingQty;
      metrics.completedPo += Number(delivery.complete);
      metrics.partialPo += Number(
        !delivery.complete && delivery.historyQty > 0,
      );
      metrics.labelCount += forecast.LabelData.length;
      metrics.deliveredLabels += delivery.deliveredLabels;
      metrics.validatedLabels += validated.length;
      metrics.validatedQty += validated.reduce(
        (sum, label) => sum + label.QtyThisBox,
        0,
      );
      metrics.awaitingDeliveryLabels += awaiting.length;
      metrics.awaitingDeliveryQty += awaitingDeliveryQty;
      metrics.shoppingCompletePo += Number(shoppingStatus === 'COMPLETE');
      metrics.shoppingStartedPo += Number(shoppingStatus === 'IN_PROGRESS');
      metrics.assemblyLabels += assemblyLabels.length;
      metrics.assemblyComplete += assemblyLabels.filter((label) =>
        label.AssemblySessions.some((item) => item.Status === 'COMPLETED'),
      ).length;
      metrics.assemblyRunning += assemblyLabels.filter((label) =>
        label.AssemblySessions.some((item) => item.Status === 'IN_PROGRESS'),
      ).length;
      metrics.directFlowPo += Number(
        forecast.LabelData.length > 0 && assemblyLabels.length === 0,
      );
      metrics.overduePo += Number(overdue);
      metrics.overdueQty += overdue ? remainingQty : 0;
      metrics.issuePo += Number(issues.length > 0);
      return {
        poId: forecast.PoId,
        partNumber: forecast.FinishGoodId,
        partName: forecast.PartData.PartName,
        period: forecast.DeliveryPeriod,
        deliveryDate: forecast.DeliveryDate.toISOString(),
        planQty: forecast.Qty,
        producedQty,
        deliveredQty: delivery.historyQty,
        remainingQty,
        labels: forecast.LabelData.length,
        deliveredLabels: delivery.deliveredLabels,
        validatedLabels: validated.length,
        awaitingDeliveryQty,
        deliveryComplete: delivery.complete,
        overdue,
        cycleBlocked: false,
        shoppingStatus,
        productionStatus: stage(producedQty, forecast.Qty),
        pokayokeStatus: stage(validated.length, forecast.LabelData.length),
        issues,
      };
    },
  );
  const periods = [...new Set(orders.map((order) => order.period))].sort(
    (a, b) => a - b,
  );
  let firstIncomplete: number | null = null;
  const cycles: ProductionDashboardCycle[] = periods.map((period) => {
    const members = orders.filter((order) => order.period === period);
    const complete = members.every((order) => order.deliveryComplete);
    const blockedByPeriod = complete ? null : firstIncomplete;
    const status = complete
      ? 'COMPLETE'
      : blockedByPeriod !== null
        ? 'BLOCKED'
        : 'CURRENT';
    if (!complete && firstIncomplete === null) firstIncomplete = period;
    members.forEach((order) => {
      order.cycleBlocked = status === 'BLOCKED';
    });
    return {
      period,
      status,
      blockedByPeriod,
      poCount: members.length,
      completedPo: members.filter((order) => order.deliveryComplete).length,
      planQty: members.reduce((sum, order) => sum + order.planQty, 0),
      deliveredQty: members.reduce((sum, order) => sum + order.deliveredQty, 0),
      remainingQty: members.reduce((sum, order) => sum + order.remainingQty, 0),
      labels: members.reduce((sum, order) => sum + order.labels, 0),
      deliveredLabels: members.reduce(
        (sum, order) => sum + order.deliveredLabels,
        0,
      ),
      awaitingDeliveryQty: members.reduce(
        (sum, order) => sum + order.awaitingDeliveryQty,
        0,
      ),
    };
  });
  metrics.cycleCount = cycles.length;
  metrics.cycleComplete = cycles.filter(
    (cycle) => cycle.status === 'COMPLETE',
  ).length;
  metrics.cycleBlocked = cycles.filter(
    (cycle) => cycle.status === 'BLOCKED',
  ).length;
  metrics.cycleBlockedQty = orders
    .filter((order) => order.cycleBlocked)
    .reduce((sum, order) => sum + order.awaitingDeliveryQty, 0);
  return {
    id: release.Id,
    releaseNumber: release.ReleaseNumber,
    planDate: release.PlanDate.toISOString(),
    metrics,
    orders,
    cycles,
    hourly,
  };
}

@Injectable()
export class ProductionDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<ProductionDashboardResponse> {
    return this.prisma.$transaction(
      async (tx) => {
        const active = await tx.productionRelease.findMany({
          where: { Status: 'RELEASED' },
          select: productionDashboardSelect,
          orderBy: [{ PlanDate: 'asc' }, { ReleaseNumber: 'asc' }],
        });
        const references = active.flatMap((release) =>
          release.Forecasts.flatMap((order) => [
            ...order.Shopping.map((pick) => `PROD-${pick.Id}`),
            ...order.LabelData.flatMap((label) =>
              label.AssemblySessions.filter(
                (session) => session.Status === 'COMPLETED',
              ).map((session) => `ASSY-${session.Id}`),
            ),
          ]),
        );
        const outputs = references.length
          ? await tx.inventoryLedger.findMany({
              where: {
                ItemCategory: 'FINISH_GOOD',
                Location: 'FINISH_GOOD_AREA',
                TransactionType: 'PRODUCTION_RESULT',
                ReferenceDoc: { in: references },
              },
              select: {
                ReferenceDoc: true,
                FinishGoodId: true,
                QtyIn: true,
                TransactionDate: true,
              },
            })
          : [];
        const holds = await tx.stockOpname.findMany({
          where: { Status: 'IN_PROGRESS' },
          select: { Category: true },
        });
        const now = new Date();
        const releases = active.map((release) =>
          buildDashboardRelease(release, outputs, now),
        );
        const metrics = emptyDashboardMetrics();
        const hourly = emptyHours(now);
        for (const release of releases) {
          for (const key of Object.keys(
            metrics,
          ) as (keyof ProductionDashboardMetrics)[])
            metrics[key] += release.metrics[key];
          release.hourly.forEach((hour, index) => {
            hourly[index].producedQty += hour.producedQty;
            hourly[index].deliveredQty += hour.deliveredQty;
          });
        }
        return {
          generatedAt: now.toISOString(),
          timezone: 'Asia/Jakarta',
          refreshSeconds: 20,
          inventoryHolds: [...new Set(holds.map((hold) => hold.Category))],
          metrics,
          releases,
          hourly,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 15000,
      },
    );
  }
}
