import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ProductionStatus } from '../../../generated/prisma/enums';

export class UpdateProductionReleaseDto {
  @ApiPropertyOptional({
    description: 'Tanggal rencana',
    example: '2026-07-20',
  })
  @IsOptional()
  @IsDateString()
  planDate?: Date;

  @ApiPropertyOptional({
    description: 'Status produksi',
    example: 'IN_PROGRESS',
  })
  @IsOptional()
  @IsEnum(ProductionStatus)
  status?: ProductionStatus;

  @ApiPropertyOptional({ description: 'Catatan', example: 'Updated schedule' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Daftar forecast IDs',
    example: ['forecast-id-1', 'forecast-id-3'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  forecastIds?: string[];

  @ApiPropertyOptional({
    description: 'Apakah tanpa lampiran/delivery attachment',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isNoAttachment?: boolean;
}
