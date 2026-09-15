import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { PartType } from '../../../generated/prisma/enums';

export class ProductionReportQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Filter by date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Filter by ManPower UID (NIK)' })
  @IsOptional()
  @IsString()
  manPowerUid?: string;

  @ApiPropertyOptional({ description: 'Filter by FinishGood PartNumber' })
  @IsOptional()
  @IsString()
  finishGoodId?: string;

  @ApiPropertyOptional({ description: 'Filter by RecordType', enum: PartType })
  @IsOptional()
  @IsEnum(PartType)
  recordType?: PartType;

  @ApiPropertyOptional({
    description:
      'Filter by Validated status (true = validated, false = not validated)',
  })
  @IsOptional()
  @Type(() => Boolean)
  isValidated?: boolean;
}

export class ValidateProductionReportDto {
  @ApiPropertyOptional({ description: 'Validation notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
