import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';

export class CreateForecastDto {
  /** PO ID dari customer */
  @ApiProperty({ description: 'PO ID', example: 'PO-001' })
  @IsString()
  @IsNotEmpty()
  poId: string;

  /** Tanggal forecast */
  @ApiProperty({ description: 'Tanggal forecast', example: '2026-07-01' })
  @IsDateString()
  date: Date;

  @ApiProperty({ description: 'Kode vendor', example: 'V-001' })
  @IsString()
  @IsNotEmpty()
  vendorCode: string;

  @ApiProperty({ description: 'Nama vendor', example: 'PT Customer XYZ' })
  @IsString()
  @IsNotEmpty()
  vendorName: string;

  @ApiProperty({ description: 'Area penerimaan', example: 'Dock A' })
  @IsString()
  @IsNotEmpty()
  receivingArea: string;

  @ApiProperty({ description: 'Tanggal pengiriman', example: '2026-07-15' })
  @IsDateString()
  deliveryDate: Date;

  @ApiProperty({
    description: 'Delivery cycle / ritase count (number of delivery trips)',
    example: 5,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  deliveryPeriod: number;

  @ApiProperty({ description: 'Klasifikasi', example: 'REGULER' })
  @IsString()
  @IsNotEmpty()
  classification: string;

  @ApiProperty({ description: 'Nomor PO', example: 'PO-2026-001' })
  @IsString()
  @IsNotEmpty()
  poNumber: string;

  @ApiProperty({ description: 'Nomor item', example: 1 })
  @IsNumber()
  item: number;

  @ApiProperty({ description: 'Qty yang diminta', example: 100 })
  @IsNumber()
  qty: number;

  @ApiProperty({ description: 'ID finish good', example: 'FG-001' })
  @IsString()
  @IsNotEmpty()
  finishGoodId: string;
}
