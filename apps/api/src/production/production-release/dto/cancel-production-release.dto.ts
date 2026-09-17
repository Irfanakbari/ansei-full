import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelProductionReleaseDto {
  @ApiProperty({
    description: 'Reason for cancelling the released production release',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
