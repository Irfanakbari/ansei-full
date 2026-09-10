import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class UploadAttachmentDto {
  @ApiProperty({ description: 'ID Production Release' })
  @IsString()
  @IsNotEmpty()
  productionReleaseId: string;

  @ApiPropertyOptional({ description: 'Forecast ID (optional)' })
  @IsOptional()
  @IsString()
  forecastId?: string;
}

export class CreateDeliveryAttachmentDto {
  @ApiProperty({ description: 'ID Production Release' })
  @IsString()
  @IsNotEmpty()
  productionReleaseId: string;

  @ApiPropertyOptional({ description: 'Forecast ID (optional)' })
  @IsOptional()
  @IsString()
  forecastId?: string;
}

/**
 * DTO for file upload endpoint
 * Note: File validation (extension, size) is done in the service
 */
export class UploadProductionAttachmentDto {
  @ApiProperty({ description: 'ID Production Release' })
  @IsString()
  @IsNotEmpty()
  productionReleaseId: string;

  @ApiPropertyOptional({ description: 'Forecast ID (optional)' })
  @IsOptional()
  @IsString()
  forecastId?: string;
}
