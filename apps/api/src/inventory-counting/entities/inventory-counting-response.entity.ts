import { ApiProperty } from '@nestjs/swagger';
import { InventoryCountingEntity } from './inventory-counting.entity';

export class InventoryCountingResponseEntity {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  processId: string;

  @ApiProperty({ type: InventoryCountingEntity })
  data: InventoryCountingEntity;
}

export class InventoryCountingRemoveResponseEntity {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  processId: string;

  @ApiProperty()
  message: string;
}

export class GenerateCutOffResponseEntity {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  processId: string;

  @ApiProperty()
  data: {
    inventoryCountingId: string;
    count: number;
    locations: string[];
  };
}

export class PaginatedInventoryCountingEntity {
  @ApiProperty({ type: [InventoryCountingEntity] })
  data: InventoryCountingEntity[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
