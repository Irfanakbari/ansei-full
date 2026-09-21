import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Common DTO for date range queries in DDMMYYYY format
 */
export class DateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Start date in DDMMYYYY format',
    example: '01072026',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, {
    message: 'fromdate must be in DDMMYYYY format (e.g., 01072026)',
  })
  fromdate?: string;

  @ApiPropertyOptional({
    description: 'End date in DDMMYYYY format',
    example: '31072026',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, {
    message: 'todate must be in DDMMYYYY format (e.g., 31072026)',
  })
  todate?: string;
}

/**
 * DTO for Stock Material Report (no date filter - all active materials)
 */
export class StockMaterialReportQueryDto {}

/**
 * DTO for Incoming Warehouse Report
 */
export class IncomingWarehouseReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Incoming Rack Report
 */
export class IncomingRackReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Transfer Material (Material Delivery Note) Report
 */
export class TransferMaterialReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Production Release Resume Report
 */
export class ProductionReleaseReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Pokayoke Scan History Report
 */
export class PokayokeScanReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Delivery History Report
 */
export class DeliveryHistoryReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Production Report
 */
export class ProductionReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Shopping History Report
 */
export class ShoppingHistoryReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Material NG Report
 */
export class MaterialNgReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Inventory Ledger Report
 */
export class InventoryLedgerReportQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by item category (MATERIAL or FINISH_GOOD)',
    example: 'MATERIAL',
    enum: ['MATERIAL', 'FINISH_GOOD'],
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by location (WAREHOUSE, RACK, FINISH_GOOD_AREA)',
    example: 'WAREHOUSE',
    enum: ['WAREHOUSE', 'RACK', 'FINISH_GOOD_AREA'],
  })
  @IsOptional()
  @IsString()
  location?: string;
}

/**
 * DTO for Production Efficiency Report
 */
export class ProductionEfficiencyReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Pokayoke Falloff Report
 */
export class PokayokeFalloffReportQueryDto extends DateRangeQueryDto {}

/**
 * DTO for Material Scrap Rate Report
 */
export class MaterialScrapRateReportQueryDto extends DateRangeQueryDto {}
