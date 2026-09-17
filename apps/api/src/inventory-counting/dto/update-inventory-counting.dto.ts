import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

export class UpdateInventoryCountingDto {
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  tolerance?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
