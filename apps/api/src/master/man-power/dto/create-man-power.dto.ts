import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateManPowerDto {
  /** NIK karyawan */
  @ApiProperty({ description: 'NIK karyawan', example: '12345678' })
  @IsString()
  @IsNotEmpty()
  nik: string;

  /** Nama karyawan */
  @ApiProperty({ description: 'Nama karyawan', example: 'Budi Santoso' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Line produksi', example: 'LINE-A' })
  @IsString()
  @IsOptional()
  line?: string;

  @ApiPropertyOptional({ description: 'Status aktif', example: true })
  @IsBoolean()
  @IsOptional()
  status?: boolean;
}
