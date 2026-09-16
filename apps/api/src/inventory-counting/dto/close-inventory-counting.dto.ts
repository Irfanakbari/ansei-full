import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';

export class CloseInventoryCountingDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsOptional()
  @IsBoolean()
  confirmedCheck?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
