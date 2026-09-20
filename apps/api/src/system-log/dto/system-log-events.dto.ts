import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const SYSTEM_LOG_EVENT_TYPES = [
  'PROCESS',
  'ACTION',
  'INTEGRATION',
] as const;

export type SystemLogEventType = (typeof SYSTEM_LOG_EVENT_TYPES)[number];

export class SystemLogEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SYSTEM_LOG_EVENT_TYPES })
  @IsOptional()
  @IsIn(SYSTEM_LOG_EVENT_TYPES)
  type?: SystemLogEventType;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

export class SystemLogEventDto {
  @ApiProperty() id: string;
  @ApiProperty() occurredAt: Date;
  @ApiProperty({ enum: SYSTEM_LOG_EVENT_TYPES }) type: SystemLogEventType;
  @ApiProperty() event: string;
  @ApiProperty({ nullable: true, type: String }) referenceType: string | null;
  @ApiProperty({ nullable: true, type: String }) referenceId: string | null;
  @ApiProperty() status: string;
  @ApiProperty({ nullable: true, type: String }) actor: string | null;
  @ApiProperty({ nullable: true, type: String }) processId: string | null;
  @ApiProperty() summary: string;
  @ApiProperty() recoverable: boolean;
}
