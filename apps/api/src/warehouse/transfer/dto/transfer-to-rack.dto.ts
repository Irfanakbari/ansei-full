import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class TransferToRackDto {
  @ApiProperty({
    description: 'Qty yang ditransfer dari gudang ke rak',
    example: 50,
  })
  @IsNumber()
  qty: number;
}
