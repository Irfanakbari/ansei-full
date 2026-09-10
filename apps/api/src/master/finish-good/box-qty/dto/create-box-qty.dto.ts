import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsPositive } from 'class-validator';

export class CreateBoxQtyDto {
  /** Part number finish good */
  @ApiProperty({ description: 'Part number finish good', example: 'FG-001' })
  @IsString()
  @IsNotEmpty()
  partNumber: string;

  /** Qty per box */
  @ApiProperty({ description: 'Qty per box', example: 50 })
  @IsNumber()
  @IsPositive()
  qty: number;
}
