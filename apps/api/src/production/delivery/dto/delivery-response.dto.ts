import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeliveryDto {
  @ApiProperty() id: number;
  @ApiProperty() forecastId: string;
  @ApiProperty() qty: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() createdBy: string;
  @ApiPropertyOptional() labelDataId: string | null;
  @ApiPropertyOptional() labelNumber: string | null;
  @ApiPropertyOptional() releaseNumber: string | null;
}

export class PaginatedDeliveryDto {
  @ApiProperty({ type: [DeliveryDto] })
  data: DeliveryDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class DeliveryQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Records per page', example: 50 })
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Filter by Forecast ID (PoId)' })
  forecastId?: string;

  @ApiPropertyOptional({ description: 'Filter by CreatedBy' })
  createdBy?: string;
}
