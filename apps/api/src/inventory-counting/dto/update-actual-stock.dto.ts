import { IsOptional, IsInt, IsString, Min } from 'class-validator';

export class UpdateActualStockDto {
  @IsInt()
  @Min(0)
  actualQty: number;

  /**
   * Actual quantity di Rack - HANYA untuk MATERIAL
   * Jika FinishGood, field ini tidak diperlukan/tidak digunakan
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  actualQtyRack?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
