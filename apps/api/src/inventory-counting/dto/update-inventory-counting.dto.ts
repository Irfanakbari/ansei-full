import { IsOptional, IsString } from 'class-validator';

export class UpdateInventoryCountingDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
