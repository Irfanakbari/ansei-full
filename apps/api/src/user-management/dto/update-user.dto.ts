import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Nama lengkap',
    example: 'John Doe Updated',
  })
  @IsOptional()
  @IsString()
  Name?: string;

  @ApiPropertyOptional({
    description: 'Email',
    example: 'john.new@ansei.co.id',
  })
  @IsOptional()
  @IsString()
  Email?: string;

  @ApiPropertyOptional({ description: 'Status aktif', example: true })
  @IsOptional()
  @IsBoolean()
  IsActive?: boolean;

  @ApiPropertyOptional({ description: 'Nomor telepon', example: '08123456789' })
  @IsOptional()
  @IsString()
  PhoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Daftar departemen yang bisa diakses',
    example: ['PRODUCTION', 'WAREHOUSE'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  DeptPermission?: string[];

  @ApiPropertyOptional({ description: 'Role ID', example: 2 })
  @IsOptional()
  @IsInt()
  RoleId?: number;
}
