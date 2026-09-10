import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsBoolean,
} from 'class-validator';

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
  @IsString()
  status?: string;

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
