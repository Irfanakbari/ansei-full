import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { ItemCategory, TransactionType } from 'src/generated/prisma/enums';

export class InventoryLedgerExportDto {
  @ApiPropertyOptional({
    description: 'Filter by transaction date (start date, YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  transactionDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction date (end date, YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  transactionDateTo?: string;

  @ApiPropertyOptional({
    description: 'Filter by ItemCategory (MATERIAL or FINISH_GOOD)',
    enum: ItemCategory,
  })
  @IsOptional()
  @IsEnum(ItemCategory)
  itemCategory?: ItemCategory;

  @ApiPropertyOptional({
    description: 'Filter by TransactionType',
    enum: TransactionType,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional({
    description: 'Filter by MaterialId (PartNumber)',
  })
  @IsOptional()
  @IsString()
  materialId?: string;

  @ApiPropertyOptional({
    description: 'Filter by FinishGoodId (PartNumber)',
  })
  @IsOptional()
  @IsString()
  finishGoodId?: string;

  @ApiPropertyOptional({
    description: 'Filter by ReferenceDoc',
  })
  @IsOptional()
  @IsString()
  referenceDoc?: string;

  @ApiPropertyOptional({
    description: 'Filter by CreatedBy',
  })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
