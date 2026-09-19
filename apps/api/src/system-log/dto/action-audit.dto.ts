/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ActionAuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  requestId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  processId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceType?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceId?: string;
  @ApiPropertyOptional({
    enum: [
      'INSERT',
      'UPDATE',
      'DELETE',
      'REPLAY',
      'RETRY',
      'DENIED',
      'FAILED',
      'CREATE',
      'QUEUE',
      'QUEUE_FAILED',
      'PREPARE',
      'PRINT_READY',
      'SEND',
      'SENDING',
      'TRANSPORT_ACCEPTED',
      'UNCERTAIN',
      'INTERRUPTED',
      'RECOVER',
      'PREPARATION_FAILED',
      'DOCUMENT_CHANGED',
      'CONFIRM_DELIVERED',
      'CLOSE',
    ],
  })
  @IsOptional()
  @IsIn([
    'INSERT',
    'UPDATE',
    'DELETE',
    'REPLAY',
    'RETRY',
    'DENIED',
    'FAILED',
    'CREATE',
    'QUEUE',
    'QUEUE_FAILED',
    'PREPARE',
    'PRINT_READY',
    'SEND',
    'SENDING',
    'TRANSPORT_ACCEPTED',
    'UNCERTAIN',
    'INTERRUPTED',
    'RECOVER',
    'PREPARATION_FAILED',
    'DOCUMENT_CHANGED',
    'CONFIRM_DELIVERED',
    'CLOSE',
  ])
  action?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() to?: string;
}

export class ActionAuditDto {
  @ApiProperty() Id: string;
  @ApiProperty() SourceType: string;
  @ApiProperty() SourceId: string;
  @ApiProperty() Action: string;
  @ApiProperty({ nullable: true, type: String }) Actor: string | null;
  @ApiProperty() ActorSource: string;
  @ApiProperty({ nullable: true, type: String }) RequestId: string | null;
  @ApiProperty({ nullable: true, type: String }) ProcessId: string | null;
  @ApiProperty({ nullable: true, type: Object }) Before: unknown;
  @ApiProperty({ nullable: true, type: Object }) After: unknown;
  @ApiProperty() CreatedAt: Date;
}
