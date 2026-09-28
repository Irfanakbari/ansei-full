import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PrintAgentStatus } from '../../../generated/prisma/enums';

export enum PrintDocumentTypeDto {
  PART_TAG_ANSEI = 'PART_TAG_ANSEI',
}

export class PrintAgentQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: PrintAgentStatus })
  @IsOptional()
  @IsEnum(PrintAgentStatus)
  status?: PrintAgentStatus;
}

export class CreatePrintAgentDto {
  @IsString()
  @MaxLength(120)
  name: string;
}

export class EnrollPrintAgentDto {
  @IsString()
  token: string;

  @IsString()
  @MaxLength(64)
  @IsOptional()
  version?: string;
}

export class HeartbeatDto {
  @IsString()
  @MaxLength(64)
  @IsOptional()
  version?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class SyncPrinterProfileDto {
  @IsString()
  @MaxLength(120)
  externalId: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsEnum(PrintDocumentTypeDto)
  documentType: PrintDocumentTypeDto;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsInt()
  @Min(1)
  revision: number;

  @IsObject()
  profile: Record<string, unknown>;
}

export class LeasePrintJobDto {
  @IsInt()
  @Min(15)
  @IsOptional()
  leaseSeconds?: number;
}

export class PrintJobLeaseDto {
  @IsString()
  leaseToken: string;

  @IsInt()
  @Min(15)
  @IsOptional()
  leaseSeconds?: number;
}

export enum PrintFailureCategoryDto {
  PRE_SPOOL = 'PRE_SPOOL',
  DELIVERY_UNCERTAIN = 'DELIVERY_UNCERTAIN',
}

export class FailPrintJobDto extends PrintJobLeaseDto {
  @IsEnum(PrintFailureCategoryDto)
  category: PrintFailureCategoryDto;

  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(500)
  message: string;
}
