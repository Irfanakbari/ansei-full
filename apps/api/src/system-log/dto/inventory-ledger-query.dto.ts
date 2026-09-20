import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ItemCategory, TransactionType } from '../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class InventoryLedgerQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Search item, reference, creator, or notes',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction date (start date, YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateFrom must be a valid date in YYYY-MM-DD format',
  })
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction date (end date, YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dateTo must be a valid date in YYYY-MM-DD format',
  })
  dateTo?: string;

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
