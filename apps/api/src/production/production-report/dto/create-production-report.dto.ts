import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartType } from '../../../generated/prisma/enums';

export class CreateProductionReportDto {
  @ApiPropertyOptional({ description: 'Production date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Production time (HH:mm:ss)' })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiProperty({ description: 'Production timestamp' })
  @IsDateString()
  productionStamp: string;

  @ApiPropertyOptional({ description: 'NG quantity', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ngQty?: number = 0;

  @ApiPropertyOptional({ description: 'Start time (HH:mm:ss)' })
  @IsOptional()
  @IsString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Start timestamp' })
  @IsOptional()
  @IsDateString()
  startStamp?: string;

  @ApiPropertyOptional({ description: 'End time (HH:mm:ss)' })
  @IsOptional()
  @IsString()
  endTime?: string;

  @ApiPropertyOptional({ description: 'End timestamp' })
  @IsOptional()
  @IsDateString()
  endStamp?: string;

  @ApiPropertyOptional({ description: 'Stop duration in minutes', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stopMinute?: number = 0;

  @ApiPropertyOptional({ description: 'Latch date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  latchDate?: string;

  @ApiPropertyOptional({ description: 'Cable H date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  cableHDate?: string;

  @ApiPropertyOptional({ description: 'Cable L date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  cableLDate?: string;

  @ApiPropertyOptional({ description: 'Cover date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  coverDate?: string;

  @ApiPropertyOptional({ description: 'Rod date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  rodDate?: string;

  @ApiPropertyOptional({ description: 'Spons date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  sponsDate?: string;

  @ApiPropertyOptional({ description: 'Spons rear date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  sponsRearDate?: string;

  @ApiPropertyOptional({ description: 'Clip date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  clipDate?: string;

  @ApiPropertyOptional({ description: 'Lever date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  leverDate?: string;

  @ApiPropertyOptional({ description: 'Small pad date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  smallPadDate?: string;

  @ApiPropertyOptional({ description: 'Actuator date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  actuatorDate?: string;

  @ApiPropertyOptional({ description: 'Back plate date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  backPlateDate?: string;

  @ApiPropertyOptional({ description: 'Stamp date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  stampDate?: string;

  @ApiPropertyOptional({ description: 'PO Number' })
  @IsOptional()
  @IsString()
  poNumber?: string;

  @ApiProperty({ description: 'Record type', enum: PartType })
  @IsEnum(PartType)
  recordType: PartType;

  @ApiProperty({ description: 'Good quantity', default: 0 })
  @IsInt()
  @Min(0)
  qty: number;

  @ApiProperty({ description: 'Man Power UID (NIK)' })
  @IsString()
  manPowerUid: string;

  @ApiProperty({ description: 'FinishGood PartNumber' })
  @IsString()
  finishGoodId: string;

  @ApiPropertyOptional({ description: 'Forecast PO ID (PoId)' })
  @IsOptional()
  @IsString()
  forecastId?: string;

  @ApiPropertyOptional({ description: 'Alias for Forecast PO ID (PoId)' })
  @IsOptional()
  @IsString()
  poId?: string;
}
