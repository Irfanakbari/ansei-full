import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SkillMatrixDto {
  @ApiProperty({ description: 'Label/nama skill', example: 'Assembly A' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ description: 'Poin skill (1-4)', example: 3 })
  @IsInt()
  @Min(1)
  @Max(4)
  point: number;
}

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

  @ApiPropertyOptional({
    description: 'URL foto karyawan',
    example:
      'http://192.168.1.15:8080/Ansei_Asset/manpower/12345678_1720000000.jpg',
  })
  @IsString()
  @IsOptional()
  picturePath?: string;

  @ApiPropertyOptional({
    description: 'Skill matrix array',
    type: [SkillMatrixDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SkillMatrixDto)
  skillMatrix?: SkillMatrixDto[];
}
