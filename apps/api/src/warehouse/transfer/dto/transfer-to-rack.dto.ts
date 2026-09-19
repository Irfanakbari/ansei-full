import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsUUID } from 'class-validator';

export class TransferToRackDto {
  @ApiProperty({
    description: 'Qty yang ditransfer dari gudang ke rak',
    example: 50,
  })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  qty: number;

  @ApiProperty({
    format: 'uuid',
    description: 'Reuse this ID only when retrying the same transfer.',
  })
  @IsUUID()
  requestId: string;
}
