import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RequestAutocompleteOtpDto {
  @ApiProperty({
    description: 'User ID of the selected manager/super approver',
    example: 'USR-001',
  })
  @IsString()
  @IsNotEmpty()
  approverUserId: string;
}
