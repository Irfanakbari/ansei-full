import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class ExecuteAutocompleteDto {
  @ApiProperty({
    description: 'ID of the OTP challenge received from request-otp',
    format: 'uuid',
  })
  @IsString()
  @IsNotEmpty()
  challengeId: string;

  @ApiProperty({
    description: '6-digit OTP code sent to approver via WhatsApp',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits' })
  otp: string;

  @ApiProperty({
    required: false,
    description:
      'Active manpower NIK used for automatically completed assembly sessions',
    example: 'EMP010',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  manpowerNik?: string;
}
