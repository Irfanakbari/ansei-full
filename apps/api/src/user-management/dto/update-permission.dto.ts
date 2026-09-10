import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePermissionDto {
  @ApiPropertyOptional({
    description: 'Nama aksi permission',
    example: 'MASTER_UPDATE',
  })
  @IsOptional()
  @IsString()
  Action?: string;

  @ApiPropertyOptional({
    description: 'Deskripsi permission',
    example: 'Hak akses mengubah data master',
  })
  @IsOptional()
  @IsString()
  Description?: string;
}
