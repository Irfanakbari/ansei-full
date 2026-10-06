/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
import { ApiProperty } from '@nestjs/swagger';

export type DashboardStageStatus =
  'PENDING' | 'IN_PROGRESS' | 'COMPLETE' | 'UNAVAILABLE';
export type DashboardCycleStatus = 'COMPLETE' | 'CURRENT' | 'BLOCKED';

export class ProductionDashboardMetrics {
  @ApiProperty() releaseCount: number;
  @ApiProperty() poCount: number;
  @ApiProperty() completedPo: number;
  @ApiProperty() partialPo: number;
  @ApiProperty() planQty: number;
  @ApiProperty({
    description:
      'FG PRODUCTION_RESULT ledger quantity attributed to these orders',
  })
  producedQty: number;
  @ApiProperty({
    description:
      'Actual DeliveryHistory quantity, independent of Poka-Yoke scans',
  })
  deliveredQty: number;
  @ApiProperty() remainingQty: number;
  @ApiProperty() labelCount: number;
  @ApiProperty() deliveredLabels: number;
  @ApiProperty() validatedLabels: number;
  @ApiProperty() validatedQty: number;
  @ApiProperty({
    description:
      'Poka-Yoke validated labels with no delivery record; not a stock availability guarantee',
  })
  awaitingDeliveryQty: number;
  @ApiProperty() awaitingDeliveryLabels: number;
  @ApiProperty() cycleBlockedQty: number;
  @ApiProperty() shoppingCompletePo: number;
  @ApiProperty() shoppingStartedPo: number;
  @ApiProperty() assemblyLabels: number;
  @ApiProperty() assemblyComplete: number;
  @ApiProperty() assemblyRunning: number;
  @ApiProperty() directFlowPo: number;
  @ApiProperty() overduePo: number;
  @ApiProperty() overdueQty: number;
  @ApiProperty() issuePo: number;
  @ApiProperty() openFindings: number;
  @ApiProperty() waitingPartChange: number;
  @ApiProperty() cycleCount: number;
  @ApiProperty() cycleComplete: number;
  @ApiProperty() cycleBlocked: number;
}

export class ProductionDashboardHour {
  @ApiProperty({ example: '08:00' }) hour: string;
  @ApiProperty() producedQty: number;
  @ApiProperty() deliveredQty: number;
}

export class ProductionDashboardOrder {
  @ApiProperty() poId: string;
  @ApiProperty() partNumber: string;
  @ApiProperty() partName: string;
  @ApiProperty() period: number;
  @ApiProperty() deliveryDate: string;
  @ApiProperty() planQty: number;
  @ApiProperty() producedQty: number;
  @ApiProperty() deliveredQty: number;
  @ApiProperty() remainingQty: number;
  @ApiProperty() labels: number;
  @ApiProperty() deliveredLabels: number;
  @ApiProperty() validatedLabels: number;
  @ApiProperty() awaitingDeliveryQty: number;
  @ApiProperty() deliveryComplete: boolean;
  @ApiProperty() overdue: boolean;
  @ApiProperty() cycleBlocked: boolean;
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'COMPLETE', 'UNAVAILABLE'] })
  shoppingStatus: DashboardStageStatus;
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'COMPLETE', 'UNAVAILABLE'] })
  productionStatus: DashboardStageStatus;
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'COMPLETE', 'UNAVAILABLE'] })
  pokayokeStatus: DashboardStageStatus;
  @ApiProperty({ type: [String] }) issues: string[];
}

export class ProductionDashboardCycle {
  @ApiProperty() period: number;
  @ApiProperty({ enum: ['COMPLETE', 'CURRENT', 'BLOCKED'] })
  status: DashboardCycleStatus;
  @ApiProperty({ nullable: true, type: Number }) blockedByPeriod: number | null;
  @ApiProperty() poCount: number;
  @ApiProperty() completedPo: number;
  @ApiProperty() planQty: number;
  @ApiProperty() deliveredQty: number;
  @ApiProperty() remainingQty: number;
  @ApiProperty() labels: number;
  @ApiProperty() deliveredLabels: number;
  @ApiProperty() awaitingDeliveryQty: number;
}

export class ProductionDashboardRelease {
  @ApiProperty() id: string;
  @ApiProperty() releaseNumber: string;
  @ApiProperty() planDate: string;
  @ApiProperty({ type: ProductionDashboardMetrics })
  metrics: ProductionDashboardMetrics;
  @ApiProperty({ type: [ProductionDashboardOrder] })
  orders: ProductionDashboardOrder[];
  @ApiProperty({ type: [ProductionDashboardCycle] })
  cycles: ProductionDashboardCycle[];
  @ApiProperty({ type: [ProductionDashboardHour] })
  hourly: ProductionDashboardHour[];
}

export class ProductionDashboardResponse {
  @ApiProperty() generatedAt: string;
  @ApiProperty({ example: 'Asia/Jakarta' }) timezone: string;
  @ApiProperty({ example: 20 }) refreshSeconds: number;
  @ApiProperty({
    type: [String],
    description: 'Inventory categories frozen by an active stock count',
  })
  inventoryHolds: string[];
  @ApiProperty({ type: ProductionDashboardMetrics })
  metrics: ProductionDashboardMetrics;
  @ApiProperty({ type: [ProductionDashboardRelease] })
  releases: ProductionDashboardRelease[];
  @ApiProperty({ type: [ProductionDashboardHour] })
  hourly: ProductionDashboardHour[];
}
