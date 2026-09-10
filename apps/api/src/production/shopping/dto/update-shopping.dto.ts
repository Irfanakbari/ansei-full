import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateShoppingDto {
  @ApiPropertyOptional({ description: 'Qty yang diambil', example: 75 })
  @IsOptional()
  @IsNumber()
  qtyPick?: number;

  @ApiPropertyOptional({
    description: 'Keterangan',
    example: 'Updated picking qty',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
