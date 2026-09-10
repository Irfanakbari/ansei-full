import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeliveryEntity {
  @ApiProperty({ description: 'Delivery record ID' })
  id: number;

  @ApiProperty({ description: 'Forecast/PO ID' })
  forecastId: string;

  @ApiProperty({
    description: 'Quantity delivered (taken from LabelData.QtyThisBox)',
  })
  qty: number;

  @ApiProperty({ description: 'Timestamp of delivery' })
  createdAt: Date;

  @ApiProperty({ description: 'User who created the delivery' })
  createdBy: string;

  @ApiPropertyOptional({
    description: 'LabelData ID associated with this delivery',
  })
  labelDataId: string | null;
}

export class DeliveryResponseEntity {
  @ApiProperty({
    description: 'Whether delivery was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Delivery successful for LabelNumber PO-00100100005',
  })
  message: string;

  @ApiProperty({
    description: 'Delivery data if successful',
    type: DeliveryEntity,
  })
  data: DeliveryEntity;
}

export class PaginatedDeliveryEntity {
  @ApiProperty({
    description: 'Array of delivery records',
    type: [DeliveryEntity],
  })
  data: DeliveryEntity[];

  @ApiProperty({
    description: 'Total number of records matching filter',
    example: 150,
  })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of records per page', example: 50 })
  limit: number;

  @ApiProperty({ description: 'Total number of pages', example: 3 })
  totalPages: number;
}
