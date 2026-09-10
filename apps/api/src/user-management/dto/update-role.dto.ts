import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({ description: 'Nama role', example: 'SUPERVISOR' })
  @IsOptional()
  @IsString()
  RoleName?: string;

  @ApiPropertyOptional({
    description: 'Deskripsi role',
    example: 'Role untuk supervisor produksi',
  })
  @IsOptional()
  @IsString()
  Description?: string;
}
