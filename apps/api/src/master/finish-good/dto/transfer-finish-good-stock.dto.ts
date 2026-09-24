import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';

export class TransferFinishGoodStockDto {
  @ApiProperty({
    description: 'Part number finish good tujuan yang akan ditambah stoknya',
    example: 'FG-002',
  })
  @IsString()
  @IsNotEmpty()
  targetPartNumber: string;

  @ApiProperty({
    description: 'Jumlah stok yang ditransfer',
    example: 50,
  })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiProperty({
    description: 'Alasan transfer stok / supersession finish good',
    example: 'Supersession model baru FG-002',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
