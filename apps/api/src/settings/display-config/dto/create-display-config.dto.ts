import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

const transformMultipartBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

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
  @ApiPropertyOptional({
    description: 'URL yang akan ditampilkan di display',
    example: 'https://display.example.com/screen/1',
  })
  @IsString()
  @IsOptional()
  url?: string;

  /** Status apakah display sedang aktif/open */
  @ApiPropertyOptional({
    description: 'Status open/close display',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(transformMultipartBoolean)
  @IsBoolean()
  isOpen?: boolean;

  /** Apakah tampilan di-loop/ulang secara otomatis */
  @ApiPropertyOptional({
    description: 'Loop tampilan secara otomatis',
    example: true,
    default: true,
  })
  @IsOptional()
  @Transform(transformMultipartBoolean)
  @IsBoolean()
  loop?: boolean;

  @ApiPropertyOptional({
    description: 'URL file media (NAS) yang diupload',
    example: 'http://192.168.1.15:8080/Ansei_Asset/video.mp4',
  })
  @IsString()
  @IsOptional()
  filePath?: string;

  @ApiPropertyOptional({
    description: 'Target line produksi',
    example: 'LINE-A',
  })
  @IsString()
  @IsOptional()
  line?: string;
}
