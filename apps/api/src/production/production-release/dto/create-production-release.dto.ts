import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsDate,
  IsBoolean,
} from 'class-validator';

export class CreateProductionReleaseDto {
  /** Nomor release produksi */
  @ApiPropertyOptional({
    description:
      'Nomor release manual. Jika dikosongkan, server akan men-generate nomor secara otomatis.',
    example: 'PR-20260921-001',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  releaseNumber?: string;

  /** Tanggal rencana produksi */
  @ApiProperty({
    description: 'Tanggal rencana produksi',
    example: '2026-07-15T00:00:00.000Z',
  })
  @IsDate()
  planDate: Date;

  @ApiPropertyOptional({
    description: 'Catatan',
    example: 'Release untuk order minggu 3',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  /** Daftar forecast ID yang akan di-release */
  @ApiProperty({
    description: 'Daftar forecast IDs',
    example: ['forecast-id-1', 'forecast-id-2'],
  })
  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  forecastIds: string[];

  /** Flag apakah production release ini tanpa lampiran/delivery attachment */
  @ApiPropertyOptional({ description: 'Apakah tanpa lampiran', example: false })
  @IsOptional()
  @IsBoolean()
  isNoAttachment?: boolean;
}
