import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductionStatus } from '../../../generated/prisma/enums';

export class ProgressItemEntity {
  @ApiProperty({ example: 100 })
  totalPicked: number;

  @ApiProperty({ example: 80 })
  totalTarget: number;

  @ApiProperty({ example: 80 })
  percentage: number;
}

export class DeliveryProgressEntity {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 50 })
  scanned: number;

  @ApiProperty({ example: 50 })
  pending: number;

  @ApiProperty({ example: 50 })
  percentage: number;
}

export class PokayokeProgressEntity {
  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 80 })
  scanned: number;

  @ApiProperty({ example: 20 })
  pending: number;

  @ApiProperty({ example: 80 })
  percentage: number;
}

export class AssemblyProgressEntity {
  @ApiProperty({ example: true })
  required: boolean;

  @ApiProperty({ example: 3 })
  total: number;

  @ApiProperty({ example: 1 })
  completed: number;

  @ApiProperty({ example: 2 })
  pending: number;

  @ApiProperty({ example: 33 })
  percentage: number;
}

export class OverallProgressEntity {
  @ApiProperty({ example: 58 })
  percentage: number;

  @ApiProperty({ example: 4 })
  stageCount: number;
}

export class ForecastItemEntity {
  @ApiProperty({ example: 'PO-2026-001' })
  PoId: string;

  @ApiProperty({ example: 'FG-001' })
  FinishGoodId: string;

  @ApiProperty({ example: 50 })
  Qty: number;

  @ApiProperty({ example: '2026-07-20' })
  DeliveryDate: Date;

  @ApiPropertyOptional({ example: 'attachment.pdf' })
  AttachmentDelivery?: string | null;

  @ApiPropertyOptional({
    type: Object,
    example: { PartNumber: 'FG-001', PartName: 'Finish Good A' },
  })
  PartData?: { PartNumber: string; PartName: string } | null;

  @ApiPropertyOptional({ type: () => Object, isArray: true, example: [] })
  Shopping?: Array<{ Id: number; QtyPick: number }>;
}

export class ProductionReleaseEntity {
  @ApiProperty({ example: 'uuid-1234' })
  Id: string;

  @ApiProperty({ example: 'PR-2026-0001' })
  ReleaseNumber: string;

  @ApiProperty({ enum: ProductionStatus, example: ProductionStatus.RELEASED })
  Status: ProductionStatus;

  @ApiPropertyOptional({ example: '2026-07-20' })
  PlanDate?: Date | null;

  @ApiProperty({ example: '2026-07-20T08:00:00.000Z' })
  CreatedAt: Date;

  @ApiProperty({ example: 'admin' })
  CreatedBy: string;

  @ApiPropertyOptional({ example: 'Administrator' })
  CreatedByName?: string;

  @ApiPropertyOptional({ example: '2026-07-20T10:00:00.000Z' })
  UpdatedAt?: Date;

  @ApiProperty({ example: 500 })
  TotalGoodQty: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 1845,
    description:
      'Actual production duration in minutes, entered at closure. Null when not recorded. Divide by 60 for KPI production hours.',
  })
  TotalProductionMinutes: number | null;

  @ApiProperty({ type: () => ProgressItemEntity })
  progressShopping: ProgressItemEntity;

  @ApiProperty({ type: () => DeliveryProgressEntity })
  progressDelivery: DeliveryProgressEntity;

  @ApiProperty({ type: () => PokayokeProgressEntity })
  progressPokayoke: PokayokeProgressEntity;

  @ApiProperty({ type: () => AssemblyProgressEntity })
  progressAssembly: AssemblyProgressEntity;

  @ApiProperty({ type: () => OverallProgressEntity })
  progressOverall: OverallProgressEntity;

  @ApiPropertyOptional({ type: () => ForecastItemEntity, isArray: true })
  Forecasts?: ForecastItemEntity[];
}

export class PaginatedProductionReleaseEntity {
  @ApiProperty({ type: () => ProductionReleaseEntity, isArray: true })
  data: ProductionReleaseEntity[];

  @ApiProperty({
    example: { page: 1, limit: 50, totalItems: 100, totalPages: 2 },
  })
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export class ProductionReleaseDetailEntity extends ProductionReleaseEntity {
  @ApiPropertyOptional({ type: () => Object, isArray: true })
  LabelDatas?: Array<{
    Id: number;
    LabelNumber: string;
    FinishGoodId: string;
    ForecastId: string;
    Scanned: boolean;
    QtyThisBox: number;
  }>;

  @ApiPropertyOptional({ type: () => Object, isArray: true })
  DeliveryAttachment?: Array<{
    Id: number;
    FileName: string;
    FilePath: string;
    CreatedAt: Date;
    CreatedBy: string;
    CreatedByName?: string;
  }>;
}

export class AttachmentResponseEntity {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiProperty({ example: 'delivery-note.pdf' })
  FileName: string;

  @ApiProperty({ example: 2048 })
  FileSize: number;

  @ApiProperty({ example: 'application/pdf' })
  MimeType: string;
}

export class DeleteAttachmentResponseDto {
  @ApiProperty({ example: true })
  deleted: boolean;

  @ApiProperty({ example: 1 })
  id: number;
}

// ==================== ATTACHMENT ENTITIES ====================

export class DeliveryAttachmentEntity {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiPropertyOptional({ example: 'PO-2026-001_20072026.pdf' })
  FileName?: string | null;

  @ApiPropertyOptional({ example: 2048 })
  FileSize?: number | null;

  @ApiPropertyOptional({ example: 'application/pdf' })
  MimeType?: string | null;

  @ApiProperty({ example: '2026-07-20T08:00:00.000Z' })
  CreatedAt: Date;

  @ApiPropertyOptional({ example: 'admin' })
  CreatedBy?: string | null;

  @ApiPropertyOptional({ example: 'Administrator' })
  CreatedByName?: string | null;

  @ApiPropertyOptional({ example: '2026-07-20T10:00:00.000Z' })
  UpdatedAt?: Date | null;

  @ApiPropertyOptional({ example: 'admin' })
  UpdatedBy?: string | null;
}

// ==================== LABEL DATA ENTITIES ====================

export class LabelDataPartDataEntity {
  @ApiProperty({ example: 'FG-001' })
  PartNumber: string;

  @ApiProperty({ example: 'Finish Good A' })
  PartName: string;
}

export class LabelDataPODataEntity {
  @ApiProperty({ example: 'PO-2026-001' })
  PoId: string;

  @ApiPropertyOptional({ example: 'Vendor ABC' })
  VendorName?: string | null;
}

export class LabelDataEntity {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiProperty({ example: '20043566050002000100050' })
  LabelNumber: string;

  @ApiProperty({ example: 'FG-001' })
  FinishGoodId: string;

  @ApiProperty({ example: 'PO-2026-001' })
  ForecastId: string;

  @ApiProperty({ example: false })
  Scanned: boolean;

  @ApiProperty({ example: 50 })
  QtyThisBox: number;

  @ApiPropertyOptional({ type: () => LabelDataPartDataEntity })
  PartData?: LabelDataPartDataEntity | null;

  @ApiPropertyOptional({ type: () => LabelDataPODataEntity })
  POData?: LabelDataPODataEntity | null;
}

// ==================== FORECAST ENTITIES ====================

export class ShoppingItemEntity {
  @ApiProperty({ example: 'SHP-001' })
  Id: string | null;

  @ApiProperty({ example: 'MAT-001' })
  MaterialId: string;

  @ApiPropertyOptional({ example: 'MAT-001' })
  MaterialPartNumber?: string;

  @ApiPropertyOptional({ example: 'Material A' })
  MaterialName?: string;

  @ApiProperty({ example: 120 })
  QtyPick: number;

  @ApiProperty({ example: 360 })
  QtyRequired: number;
}

export class ForecastWithShoppingEntity {
  @ApiProperty({ example: '200435660500020' })
  PoId: string;

  @ApiProperty({ example: 'FG-001' })
  FinishGoodId: string;

  @ApiProperty({ example: 30 })
  Qty: number;

  @ApiProperty({ example: 90 })
  QtyRequired: number;

  @ApiProperty({ example: '2026-07-21T00:00:00.000Z' })
  DeliveryDate: Date;

  @ApiPropertyOptional({ example: 'attachment.pdf' })
  AttachmentDelivery?: string | null;

  @ApiPropertyOptional({ type: () => LabelDataPartDataEntity })
  PartData?: LabelDataPartDataEntity | null;

  @ApiProperty({ type: () => ShoppingItemEntity, isArray: true })
  Shopping: ShoppingItemEntity[];
}

export class ForecastListResponseEntity {
  @ApiProperty({ type: () => ForecastWithShoppingEntity, isArray: true })
  Forecasts: ForecastWithShoppingEntity[];
}
