/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
export class IntegrationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['PENDING', 'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED'])
  status?: 'PENDING' | 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  @ApiPropertyOptional({
    enum: ['PRINT_PART_TAG_ANSEI', 'DELIVERY_NOTE_EMAIL'],
  })
  @IsOptional()
  @IsIn(['PRINT_PART_TAG_ANSEI', 'DELIVERY_NOTE_EMAIL'])
  type?: 'PRINT_PART_TAG_ANSEI' | 'DELIVERY_NOTE_EMAIL';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  referenceId?: string;
}
export class RecoverIntegrationDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() requestId: string;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483646) expectedAttempts: number;
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Matches(/\S/)
  @MaxLength(500)
  reason: string;
  @ApiProperty({ enum: ['RETRY', 'CONFIRM_DELIVERED', 'CLOSE'] })
  @IsIn(['RETRY', 'CONFIRM_DELIVERED', 'CLOSE'])
  action: 'RETRY' | 'CONFIRM_DELIVERED' | 'CLOSE';
  @ApiPropertyOptional({
    description:
      'Required for uncertain delivery after checking the external result and stopping any old worker.',
  })
  @IsOptional()
  @IsBoolean()
  outcomeReconciled?: boolean;
}
export class IntegrationEventDto {
  @ApiProperty({
    enum: [
      'NOT_COMPLETED',
      'TRANSPORT_ACCEPTED',
      'MANUAL_CONFIRMATION',
      'LEGACY_UNVERIFIED',
    ],
  })
  completionEvidence: string;
  @ApiProperty() id: string;
  @ApiProperty() type: string;
  @ApiProperty() status: string;
  @ApiProperty() attempts: number;
  @ApiProperty() maxAttempts: number;
  @ApiProperty() nextAttemptAt: Date;
  @ApiProperty({ nullable: true, type: Object }) error: {
    code: string;
    message: string;
  } | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ nullable: true, type: Date }) succeededAt: Date | null;
  @ApiProperty({ nullable: true, type: Date }) failedAt: Date | null;
  @ApiProperty({ nullable: true, type: String }) referenceType: string | null;
  @ApiProperty({ nullable: true, type: String }) referenceId: string | null;
}
export class IntegrationSummaryDto {
  @ApiProperty() pending: number;
  @ApiProperty() queued: number;
  @ApiProperty() processing: number;
  @ApiProperty() failed: number;
  @ApiProperty() uncertain: number;
  @ApiProperty() exhausted: number;
  @ApiProperty({ nullable: true, type: Date }) oldestPendingAt: Date | null;
  @ApiProperty() queueAvailable: boolean;
  @ApiProperty() printerQueueAvailable: boolean;
  @ApiProperty() observedAt: Date;
}
