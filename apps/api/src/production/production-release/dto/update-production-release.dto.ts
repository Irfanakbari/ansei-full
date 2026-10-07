import {
  ValidateIf as SelectionOptional,
  IsOptional as OptionalDemand,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { ProductionStatus } from '../../../generated/prisma/enums';

export class UpdateProductionReleaseDto {
  @OptionalDemand()
  @IsArray()
  @IsString({ each: true })
  demandIds?: string[];

  @ApiPropertyOptional({
    description: 'Tanggal rencana',
    example: '2026-07-20',
  })
  @IsOptional()
  @IsDateString()
  planDate?: Date;

  @ApiPropertyOptional({
    description:
      'Transisi status: DRAFT ke RELEASED, lalu COMPLETED setelah seluruh PO selesai delivery. Pembatalan melalui endpoint cancel.',
    enum: ProductionStatus,
    example: 'RELEASED',
  })
  @IsOptional()
  @IsEnum(ProductionStatus)
  status?: ProductionStatus;

  @ApiPropertyOptional({
    description:
      'Actual total production duration in minutes. Required only when closing a RELEASED production release; supports durations longer than 24 hours.',
    example: 1845,
    minimum: 1,
    maximum: 2147483647,
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  totalProductionMinutes?: number;

  @ApiPropertyOptional({ description: 'Catatan', example: 'Updated schedule' })
  @IsOptional()
  @IsString()
  notes?: string;

  @SelectionOptional(
    (dto: { demandIds?: string[] }) => dto.demandIds === undefined,
  )
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
