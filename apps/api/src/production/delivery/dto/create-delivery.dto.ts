import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class CreateDeliveryDto {
  @ApiProperty({
    description:
      'LabelData ID to deliver (qty will be taken from LabelData.QtyThisBox)',
    example: 1,
  })
  @IsInt()
  @Min(1)
  labelDataId: number;

  @ApiPropertyOptional({
    description: 'Optional Pallet ID / Code for delivery',
    example: 'PP2PANS001',
  })
  @IsOptional()
  @IsString()
  palletNumber?: string;
}

export class DeliveryQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Records per page', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Filter by Forecast ID (PoId)' })
  @IsOptional()
  @IsString()
  forecastId?: string;

  @ApiPropertyOptional({ description: 'Filter by CreatedBy' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
