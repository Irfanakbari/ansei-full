import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'user001',
    description: 'User ID of the user who will use this API Key',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    example: 'HRIS Integration',
    description: 'Descriptive name for this API Key',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'API Key for HRIS system integration',
    description: 'Optional description for this API Key',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}
