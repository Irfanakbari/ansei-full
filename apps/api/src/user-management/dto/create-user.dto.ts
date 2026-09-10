import {
  IsOptional,
  IsString,
  IsArray,
  IsInt,
  IsBoolean,
  IsNotEmpty,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'User ID / Username', example: 'john.doe' })
  @IsNotEmpty()
  @IsString()
  UserId: string;

  @ApiProperty({ description: 'Password', example: 'SecureP@ss123' })
  @IsNotEmpty()
  @IsString()
  Password: string;

  @ApiProperty({ description: 'Nama lengkap', example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  Name: string;

  @ApiProperty({ description: 'Email', example: 'john.doe@ansei.co.id' })
  @IsNotEmpty()
  @IsEmail()
  Email: string;

  @ApiPropertyOptional({ description: 'Status aktif', example: true })
  @IsOptional()
  @IsBoolean()
  IsActive?: boolean;

  @ApiPropertyOptional({
    description: 'Daftar departemen yang bisa diakses',
    example: ['PRODUCTION', 'WAREHOUSE'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  DeptPermission?: string[];

  @ApiPropertyOptional({ description: 'Role ID', example: 1 })
  @IsOptional()
  @IsInt()
  RoleId?: number;

  @ApiPropertyOptional({ description: 'Nomor telepon', example: '08123456789' })
  @IsOptional()
  @IsString()
  PhoneNumber?: string;
}
