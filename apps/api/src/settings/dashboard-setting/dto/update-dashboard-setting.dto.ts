import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class UpdateDashboardSettingDto {
  @ApiPropertyOptional({
    description: 'Tanggal mulai periode',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Tanggal akhir periode',
    example: '2026-07-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
