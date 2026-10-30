import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  Min,
  Max,
  IsUUID,
  IsOptional,
  IsString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({
    description: 'Part number material yang ditransfer',
    example: 'B1F-B0350',
  })
  @IsString()
  @IsNotEmpty()
  partNumber: string;

  @ApiProperty({
    description: 'Qty yang ditransfer dari gudang ke rak',
    example: 50,
  })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  qty: number;

  @ApiPropertyOptional({
    description: 'Catatan tambahan transfer',
    example: 'Transfer stok untuk line 1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Reuse this ID only when retrying the same transfer.',
  })
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @ApiPropertyOptional({
    description:
      'Scanned material PartNumber or RackLocation for PDA verification.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  scanCode?: string;
}
