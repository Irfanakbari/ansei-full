import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ description: 'Nama aksi permission', example: 'MASTER_READ' })
  @IsNotEmpty()
  @IsString()
  Action: string;

  @ApiPropertyOptional({
    description: 'Deskripsi permission',
    example: 'Hak akses membaca data master',
  })
  @IsOptional()
  @IsString()
  Description?: string;
}
