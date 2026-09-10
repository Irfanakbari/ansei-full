import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class CreateBillOfMaterialsDto {
  /** ID material */
  @ApiProperty({ description: 'ID material', example: 1 })
  @IsNumber()
  @IsPositive()
  materialId: number;

  /** ID finish good */
  @ApiProperty({ description: 'ID finish good', example: 1 })
  @IsNumber()
  @IsPositive()
  finishGoodId: number;

  /** Qty kebutuhan material per 1 unit FG */
  @ApiProperty({ description: 'Qty kebutuhan per unit FG', example: 4 })
  @IsNumber()
  @IsPositive()
  qty: number;
}
