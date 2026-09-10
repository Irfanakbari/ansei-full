import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePrinterSettingDto {
  /** Nama printer */
  @ApiPropertyOptional({
    description: 'Nama printer',
    example: 'Printer Gudang 1',
  })
  @IsOptional()
  @IsString()
  name?: string;

  /** IP Address printer */
  @ApiProperty({ description: 'IP Address printer', example: '192.168.1.100' })
  @IsString()
  @IsNotEmpty()
  ipAddress: string;
}
