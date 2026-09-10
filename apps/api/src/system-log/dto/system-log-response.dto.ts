import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogProcessDetailDto {
  @ApiProperty() id: number;
  @ApiProperty() processId: string;
  @ApiProperty() messageId: string;
  @ApiProperty() message: string;
  @ApiProperty() type: string;
  @ApiProperty() location: string;
  @ApiPropertyOptional() processDate: Date | null;
  @ApiProperty() createdAt: Date;
}

export class LogProcessDto {
  @ApiProperty() processId: string;
  @ApiProperty() functionId: string;
  @ApiProperty() functionName: string;
  @ApiProperty() processStatus: string;
  @ApiPropertyOptional() processDate: Date | null;
  @ApiPropertyOptional() processStart: Date | null;
  @ApiPropertyOptional() processEnd: Date | null;
  @ApiProperty() createdAt: Date;
}

export class LogProcessDetailResponseDto extends LogProcessDto {
  @ApiProperty({ type: [LogProcessDetailDto] })
  details: LogProcessDetailDto[];
}

export class PaginatedLogProcessDto {
  @ApiProperty({ type: [LogProcessDto] })
  data: LogProcessDto[];

  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
