import {
  IsIn as IsDemandSource,
  ValidateIf as SelectionOptional,
  IsOptional as OptionalDemand,
} from 'class-validator';
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
  @OptionalDemand()
  @IsArray()
  @IsString({ each: true })
  demandIds?: string[];

  @OptionalDemand()
  @IsDemandSource(['PO', 'NON_PO'])
  sourceType?: 'PO' | 'NON_PO';

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
  @SelectionOptional(
    (dto: { demandIds?: string[] }) => dto.demandIds === undefined,
  )
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
