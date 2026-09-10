import { IsString, IsOptional, IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendDeliveryNoteEmailDto {
  @ApiProperty({
    description: 'Recipient email addresses (comma-separated or array)',
    example: 'recipient@example.com',
    type: String,
  })
  @IsString()
  to: string;

  @ApiPropertyOptional({
    description: 'CC email addresses (comma-separated or array)',
    example: 'cc@example.com',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  cc?: string;

  @ApiPropertyOptional({
    description: 'Email subject (optional, defaults to Delivery Note number)',
    example: 'Delivery Note - SJ-MAT/2026/07/0001',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: 'Additional message to include in email body',
    example: 'Please confirm receipt once materials arrive.',
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
}
