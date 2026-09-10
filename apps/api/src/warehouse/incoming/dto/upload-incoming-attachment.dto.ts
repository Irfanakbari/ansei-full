import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * DTO for file upload endpoint
 * Note: File validation (extension, size) is done in the service
 */
export class UploadIncomingAttachmentDto {
  @ApiPropertyOptional({
    description: 'Description or notes for the attachment',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
