import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class DiscontinueMaterialDto {
  @ApiPropertyOptional({
    description: 'Alasan discontinue',
    example: 'Produksi discontinue oleh supplier',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
