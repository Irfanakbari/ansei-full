import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferHistoryItemEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  referenceDoc: string;

  @ApiProperty()
  materialId: string;

  @ApiProperty()
  partName: string;

  @ApiPropertyOptional()
  rackLocation: string | null;

  @ApiProperty()
  qty: number;

  @ApiProperty()
  warehouseBefore: number;

  @ApiProperty()
  warehouseAfter: number;

  @ApiProperty()
  rackBefore: number;

  @ApiProperty()
  rackAfter: number;

  @ApiProperty()
  transactionDate: Date;

  @ApiProperty()
  createdBy: string;

  @ApiPropertyOptional()
  createdByName?: string;

  @ApiProperty({ enum: ['COMPLETED', 'REVERTED'] })
  status: 'COMPLETED' | 'REVERTED';

  @ApiPropertyOptional()
  revertedAt?: Date | null;

  @ApiPropertyOptional()
  revertedBy?: string | null;

  @ApiPropertyOptional()
  revertedByName?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;
}

export class RevertTransferResultEntity {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  referenceDoc: string;

  @ApiProperty()
  partNumber: string;

  @ApiProperty()
  transferQty: number;

  @ApiProperty()
  warehouseBefore: number;

  @ApiProperty()
  warehouseAfter: number;

  @ApiProperty()
  rackBefore: number;

  @ApiProperty()
  rackAfter: number;

  @ApiProperty()
  revertedAt: Date;

  @ApiProperty()
  revertedBy: string;

  @ApiPropertyOptional()
  revertedByName?: string;
}
