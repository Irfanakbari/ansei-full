import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum PrintDocumentTypeDto {
  PART_TAG_ANSEI = 'PART_TAG_ANSEI',
}

export class CreatePrintAgentDto {
  @IsString()
  @MaxLength(120)
  name: string;
}

export class IssueEnrollmentDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  expiresInMinutes?: number;
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
