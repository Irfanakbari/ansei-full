import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class RevertTransferDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Reuse this ID only when retrying the same revert.',
  })
  @IsUUID()
  requestId: string;

  @ApiProperty({
    description: 'Alasan revert / pembatalan transfer',
    example: 'Salah input quantity',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
