import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ItemCategory,
  TransactionType,
  LocationType,
} from '../../generated/prisma/enums';

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
