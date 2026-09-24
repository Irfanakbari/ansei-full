import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class DiscontinueFinishGoodDto {
  @ApiPropertyOptional({
    description: 'Alasan discontinue finish good',
    example: 'Engineering Change Order (ECO) - model baru',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
