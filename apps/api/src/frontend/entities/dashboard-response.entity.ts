import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardSummaryEntity {
  @ApiProperty() totalMaterials: number;
  @ApiProperty() totalSuppliers: number;
  @ApiProperty() totalFinishGoods: number;
  @ApiProperty() totalManPower: number;
  @ApiProperty() totalIncomingQty: number;
  @ApiProperty() totalDeliveryQty: number;
}

export class DailyForecastStatEntity {
  @ApiProperty() date: string;
  @ApiProperty() count: number;
  @ApiProperty() totalQty: number;
}

export class DailyIncomingStatEntity {
  @ApiProperty() date: string;
  @ApiPropertyOptional() count?: number;
  @ApiProperty() totalQty: number;
}

export class DailyDeliveryStatEntity {
  @ApiProperty() date: string;
  @ApiProperty() totalQty: number;
}

export class DashboardDailyEntity {
  @ApiProperty() date: string;
  @ApiProperty() demandQty: number;
  @ApiProperty() approvedIncomingMaterialQty: number;
  @ApiPropertyOptional() approvedIncomingDocumentCount?: number;
  @ApiProperty({
    description:
      'Good output reported through ProductionReport because LabelData has no scan timestamp',
  })
  reportedGoodQty: number;
  @ApiProperty({
    description:
      'Shipment throughput recorded on this Jakarta calendar day within the selected month',
  })
  deliveredQty: number;
  @ApiProperty() reportedNgQty: number;
}

export class DashboardTopSupplierEntity {
  @ApiProperty() supplierId: number;
  @ApiProperty() supplierName: string;
  @ApiProperty() documentCount: number;
  @ApiProperty() totalQty: number;
}

export class DashboardTopIncomingMaterialEntity {
  @ApiProperty() partNumber: string;
  @ApiProperty() partName: string;
  @ApiProperty() totalQty: number;
}

export class DashboardRecentIncomingEntity {
  @ApiProperty() id: string;
  @ApiProperty() poId: string;
  @ApiProperty() supplierName: string;
  @ApiPropertyOptional({ nullable: true }) approvedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() closed: boolean;
  @ApiProperty() totalQty: number;
  @ApiProperty() materialCount: number;
}

export class DashboardResponseEntity {
  @ApiProperty() meta: {
    period: string;
    timezone: 'Asia/Jakarta';
    periodStart: Date;
    periodEndExclusive: Date;
    asOf: Date;
    productionOutputMetric: 'reportedGoodQty';
  };
  @ApiProperty() currentSnapshot: {
    masterData: {
      activeMaterials: number;
      suppliers: number;
      finishGoods: number;
      activeManpower: number;
    };
    inventory: {
      outOfStockPartCount: number;
      lowStockPartCount: number;
      negativeBalancePartCount: number;
    };
    freezes: {
      activeMaterial: DashboardFreezeEntity[];
      activeFinishGood: DashboardFreezeEntity[];
    };
    openExceptions: {
      overdueForecastCount: number;
      openIncomingCount: number;
      unvalidatedReportCount: number;
      pendingLabelCount: number;
      openMaterialNgCaseCount: number;
    };
  };
  @ApiProperty({
    description:
      'Selected-month metrics. Delivery deliveredQty is lifetime delivered quantity capped by target for forecasts due in the selected month; it is not the sum of daily shipment throughput.',
  })
  monthly: {
    demand: {
      forecastCount: number;
      forecastQty: number;
      unscheduledCount: number;
      unscheduledQty: number;
      releasedQty: number;
    };
    incoming: {
      approvedDocumentCount: number;
      approvedMaterialQty: number;
      openDocumentCount: number;
      activeSupplierCount?: number;
    };
    production: {
      releaseCountsByStatus: Record<string, number>;
      targetQty: number;
      scannedGoodQty: number;
      productionAttainmentPct: number | null;
      reportedQty: number;
      reportedNgQty: number;
      ngRatePct: number | null;
      unvalidatedReportCount: number;
    };
    assembly: { inProgress: number; completed: number; cancelled: number };
    pokayoke: {
      scannedLabels: number;
      pendingLabels: number;
      failedAttempts: number;
    };
    delivery: {
      deliveredQty: number;
      attainmentPct: number | null;
      overdueForecastCount: number;
      overdueOpenQty: number;
    };
    materialNg: { openCaseCount: number; outstandingReplacementQty: number };
  };
  @ApiProperty({ type: [DashboardDailyEntity] }) daily: DashboardDailyEntity[];
  @ApiProperty({
    description:
      'Released production releases whose PlanDate is within the selected month, newest first (maximum 10)',
  })
  releasePipeline: DashboardReleasePipelineEntity[];
  @ApiProperty() inventoryRisk: DashboardInventoryRiskEntity[];
  @ApiProperty() topParts: DashboardTopPartEntity[];
  @ApiPropertyOptional({ type: [DashboardTopSupplierEntity] })
  topSuppliers?: DashboardTopSupplierEntity[];
  @ApiPropertyOptional({ type: [DashboardTopIncomingMaterialEntity] })
  topIncomingMaterials?: DashboardTopIncomingMaterialEntity[];
  @ApiPropertyOptional({ type: [DashboardRecentIncomingEntity] })
  recentIncoming?: DashboardRecentIncomingEntity[];
  @ApiProperty() exceptions: DashboardExceptionEntity[];
  @ApiPropertyOptional() summary: DashboardSummaryEntity;
  @ApiPropertyOptional() forecastDailyStats: DailyForecastStatEntity[];
  @ApiPropertyOptional() incomingDailyStats: DailyIncomingStatEntity[];
  @ApiPropertyOptional() deliveryDailyStats: DailyDeliveryStatEntity[];
  @ApiPropertyOptional() currentMonth: string;
  @ApiPropertyOptional() daysInMonth: number;
}

export class DashboardFreezeEntity {
  id: string;
  opnameNumber: string;
  startedAt: Date | null;
  progress: number;
}

export class DashboardReleasePipelineEntity {
  releaseId: string;
  releaseNumber: string;
  planDate: Date;
  status: string;
  targetQty: number;
  @ApiProperty({
    nullable: true,
    description:
      'Completed ShoppingCompletion-linked forecasts divided by all forecasts in the release; null when the release has no forecasts',
  })
  shoppingPct: number | null;
  @ApiProperty({
    nullable: true,
    description:
      'Quantity-weighted completion for labels that require assembly; 100 when existing labels do not require assembly, null when labels have not been generated.',
  })
  assemblyPct: number | null;
  pokayokePct: number | null;
  deliveryPct: number | null;
}

export class DashboardInventoryRiskEntity {
  partNumber: string;
  partName: string;
  totalStock: number;
  minimumStock: number;
  shortageQty: number;
  status: 'OUT' | 'LOW' | 'NEGATIVE';
}

export class DashboardTopPartEntity {
  partNumber: string;
  partName: string;
  demandQty: number;
  deliveredQty: number;
  ngQty: number;
}

export class DashboardExceptionEntity {
  type: string;
  title: string;
  description: string;
  occurredAt: Date;
  route: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}
