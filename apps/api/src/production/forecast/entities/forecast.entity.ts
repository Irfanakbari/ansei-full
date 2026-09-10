import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PartData Entity - Finish Good data for forecast
 */
export class PartDataEntity {
  @ApiProperty({ description: 'Part number FG', example: 'FG-001' })
  PartNumber: string;

  @ApiProperty({ description: 'Nama part FG', example: 'Cover Assembly A' })
  PartName: string;
}

/**
 * Forecast Entity - Forecast response format
 */
export class ForecastEntity {
  @ApiProperty({ description: 'ID forecast', example: 1 })
  Id: number;

  @ApiProperty({ description: 'PO ID', example: 'PO-001' })
  PoId: string;

  @ApiProperty({
    description: 'Tanggal forecast',
    example: '2026-07-01T00:00:00.000Z',
  })
  Date: Date;

  @ApiProperty({ description: 'Kode vendor', example: 'V-001' })
  VendorCode: string;

  @ApiProperty({ description: 'Nama vendor', example: 'PT Customer XYZ' })
  VendorName: string;

  @ApiProperty({ description: 'Area penerimaan', example: 'Dock A' })
  ReceivingArea: string;

  @ApiProperty({
    description: 'Tanggal pengiriman',
    example: '2026-07-15T00:00:00.000Z',
  })
  DeliveryDate: Date;

  @ApiProperty({ description: 'Periode pengiriman', example: 1 })
  DeliveryPeriod: number;

  @ApiProperty({ description: 'Klasifikasi', example: 'REGULER' })
  Classification: string;

  @ApiProperty({ description: 'Nomor PO', example: 'PO-2026-001' })
  PoNumber: string;

  @ApiProperty({ description: 'Nomor item', example: 1 })
  Item: number;

  @ApiProperty({ description: 'Qty yang diminta', example: 100 })
  Qty: number;

  @ApiProperty({ description: 'ID finish good', example: 'FG-001' })
  FinishGoodId: string;

  @ApiPropertyOptional({
    description: 'ID production release',
    nullable: true,
    example: 'PR-001',
  })
  ProductionReleaseId: string | null;

  @ApiProperty({ description: 'Data part finish good', type: PartDataEntity })
  PartData: PartDataEntity;
}

/**
 * Forecast Operator Entity - Extended forecast for operator view
 */
export class ForecastOperatorEntity extends ForecastEntity {
  @ApiProperty({ description: 'Data shopping terkait', type: [Object] })
  Shopping: { ForecastId: string }[];
}
