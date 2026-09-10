import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: 'Nama role', example: 'OPERATOR' })
  @IsNotEmpty()
  @IsString()
  RoleName: string;

  @ApiPropertyOptional({
    description: 'Deskripsi role',
    example: 'Role untuk operator produksi',
  })
  @IsOptional()
  @IsString()
  Description?: string;
}
