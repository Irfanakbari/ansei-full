import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class RequestAutocompleteOtpDto {
  @ApiProperty({
    description: 'User ID of the selected manager/super approver',
    example: 'USR-001',
  })
  @IsString()
  @IsNotEmpty()
  approverUserId: string;

  @ApiPropertyOptional({
    description:
      'Optional WhatsApp phone number if approver has no phone registered in DB',
    example: '081234567890',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\+?62|0)[0-9]{8,15}$/, {
    message: 'Invalid Indonesian phone number format',
  })
  phoneNumber?: string;
}
