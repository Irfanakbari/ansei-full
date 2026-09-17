import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateInventoryCountingDto {
  @IsOptional()
  @IsNumber()
  tolerance?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
