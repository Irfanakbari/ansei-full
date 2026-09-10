import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ItemCategory,
  TransactionType,
  LocationType,
} from 'src/generated/prisma/enums';

export class InventoryLedgerDto {
  @ApiProperty() id: string;
  @ApiProperty() transactionDate: Date;
  @ApiProperty({ enum: ItemCategory }) itemCategory: ItemCategory;
  @ApiPropertyOptional() materialId: string | null;
  @ApiPropertyOptional() finishGoodId: string | null;
  @ApiProperty({ enum: LocationType }) location: LocationType;
  @ApiProperty({ enum: TransactionType }) transactionType: TransactionType;
  @ApiProperty() referenceDoc: string;
  @ApiProperty() balanceBefore: number;
  @ApiProperty() qtyIn: number;
  @ApiProperty() qtyOut: number;
  @ApiProperty() balanceAfter: number;
  @ApiProperty() createdBy: string;
  @ApiPropertyOptional() notes: string | null;
}

export class PaginatedInventoryLedgerDto {
  @ApiProperty({ type: [InventoryLedgerDto] })
  data: InventoryLedgerDto[];

  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
