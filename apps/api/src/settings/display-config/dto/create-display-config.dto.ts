import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUrl,
} from 'class-validator';

export class CreateDisplayConfigDto {
  /** Deskripsi display */
  @ApiProperty({
    description: 'Deskripsi display',
    example: 'Display Utama Gudang',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  /** URL untuk display */
  @ApiProperty({
    description: 'URL yang akan ditampilkan di display',
    example: 'https://display.example.com/screen/1',
  })
  @IsString()
  @IsNotEmpty()
  url: string;

  /** Status apakah display sedang aktif/open */
  @ApiPropertyOptional({
    description: 'Status open/close display',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  /** Apakah tampilan di-loop/ulang secara otomatis */
  @ApiPropertyOptional({
    description: 'Loop tampilan secara otomatis',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  loop?: boolean;
}
