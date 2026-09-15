import { ApiProperty } from '@nestjs/swagger';

export class PokayokeScanEntity {
  @ApiProperty({ description: 'Scan record ID' })
  id: number;

  @ApiProperty({
    description: 'Label number that was scanned',
    example: 'PO-00100100005',
  })
  labelNumber: string;

  @ApiProperty({ description: 'Forecast/PO ID', example: 'PO-001' })
  poId: string;

  @ApiProperty({ description: 'FinishGood PartNumber', example: 'FG-001' })
  partNumber: string;

  @ApiProperty({ description: 'FinishGood name', example: 'Finish Good Alpha' })
  partName: string;

  @ApiProperty({ description: 'Scan result status', example: 'SUKSES' })
  status: string;

  @ApiProperty({ description: 'Timestamp when scan was performed' })
  createdAt: Date;

  @ApiProperty({
    description: 'User who performed the scan',
    example: 'OPERATOR',
  })
  createdBy: string;
}

export class PokayokeScanResponseEntity {
  @ApiProperty({ description: 'Whether scan was successful', example: true })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'POKAYOKE scan successful for LabelNumber PO-00100100005',
  })
  message: string;

  @ApiProperty({
    description: 'Scan data if successful',
    type: PokayokeScanEntity,
    nullable: true,
  })
  data?: PokayokeScanEntity;

  @ApiProperty({
    description: 'Error message if failed',
    example: 'LabelNumber not found',
    nullable: true,
  })
  error?: string;
}

export class PaginatedPokayokeScanEntity {
  @ApiProperty({
    description: 'Array of scan records',
    type: [PokayokeScanEntity],
  })
  data: PokayokeScanEntity[];

  @ApiProperty({
    description: 'Total number of records matching filter',
    example: 150,
  })
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}
