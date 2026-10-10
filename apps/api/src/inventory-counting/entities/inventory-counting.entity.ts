import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OpnameStatus, ItemCategory } from '../../generated/prisma/enums';
import { SapDocumentSummary } from '../../common/sap/sap-document-summary';

export class InventoryCountingDetailEntity {
  @ApiProperty()
  Id: number;

  @ApiProperty()
  OpnameId: string;

  @ApiPropertyOptional()
  MaterialId: string | null;

  @ApiPropertyOptional()
  FinishGoodId: string | null;

  @ApiProperty()
  Location: string;

  // System snapshot quantities
  @ApiProperty()
  SystemQty: number;

  @ApiPropertyOptional()
  SystemQtyRack: number | null;

  // Actual counting quantities
  @ApiPropertyOptional()
  ActualQty: number | null;

  @ApiPropertyOptional()
  ActualQtyRack: number | null;

  // Calculated differences
  @ApiPropertyOptional()
  DiffQty: number | null;

  @ApiPropertyOptional()
  DiffQtyRack: number | null;

  @ApiPropertyOptional()
  Notes: string | null;
}

export class InventoryCountingEntity {
  @ApiPropertyOptional({ type: [SapDocumentSummary] })
  SAPDocuments?: SapDocumentSummary[];

  @ApiPropertyOptional({
    type: Object,
    description:
      'Local SAP counting state: integrated, ready (verified freeze), held (stock barrier).',
  })
  SAPCounting?: { integrated: boolean; ready: boolean; held: boolean };
  @ApiProperty()
  Id: string;

  @ApiProperty()
  RecordNumber: string;

  @ApiProperty({ enum: ItemCategory })
  Category: ItemCategory;

  @ApiProperty({ enum: OpnameStatus })
  Status: OpnameStatus;

  @ApiPropertyOptional({ default: 0, nullable: true })
  Tolerance: number | null;

  @ApiProperty()
  CreatedAt: Date;

  @ApiProperty()
  CreatedBy: string;

  @ApiPropertyOptional({ description: 'Nama user pembuat' })
  CreatedByName?: string;

  @ApiPropertyOptional()
  StartedAt: Date | null;

  @ApiPropertyOptional()
  CompletedAt: Date | null;

  @ApiPropertyOptional()
  CompletedBy: string | null;

  @ApiPropertyOptional()
  Notes: string | null;

  @ApiPropertyOptional({ type: [InventoryCountingDetailEntity] })
  Details?: InventoryCountingDetailEntity[];

  @ApiPropertyOptional()
  TotalItems?: number;

  @ApiPropertyOptional()
  CompletedItems?: number;
}
