import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserManagementEntity {
  @ApiProperty({ description: 'ID unik user', example: 'clxyz123abc' })
  Id: string;

  @ApiProperty({ description: 'User ID / Username', example: 'admin001' })
  UserId: string;

  @ApiProperty({ description: 'Status aktif user', example: true })
  IsActive: boolean;

  @ApiProperty({ description: 'Nama lengkap user', example: 'John Doe' })
  Name: string;

  @ApiPropertyOptional({
    description: 'Waktu login terakhir',
    nullable: true,
    example: '2026-06-14T09:00:00.000Z',
  })
  LastLogin: Date | null;

  @ApiProperty({ description: 'Email user', example: 'john.doe@ansei.co.id' })
  Email: string;

  @ApiPropertyOptional({
    description: 'Nomor telepon',
    nullable: true,
    example: '08123456789',
  })
  PhoneNumber: string | null;

  @ApiProperty({
    description: 'Daftar departemen yang bisa diakses',
    example: ['PRODUCTION', 'WAREHOUSE'],
  })
  DeptPermission: string[];

  @ApiPropertyOptional({
    description: 'Role ID',
    nullable: true,
    example: 1,
  })
  RoleId: number | null;
}

export class RoleEntity {
  @ApiProperty({ description: 'Role ID', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Nama role', example: 'SUPER' })
  RoleName: string;

  @ApiPropertyOptional({
    description: 'Deskripsi role',
    nullable: true,
    example: 'Super administrator dengan akses penuh',
  })
  Description: string | null;

  @ApiProperty({
    description: 'Tanggal dibuat',
    example: '2026-01-01T00:00:00.000Z',
  })
  CreateDate: Date;

  @ApiPropertyOptional({
    description: 'Dibuat oleh',
    nullable: true,
    example: 'admin',
  })
  CreateBy: string | null;

  @ApiPropertyOptional({
    description: 'Tanggal update terakhir',
    nullable: true,
    example: '2026-06-14T09:00:00.000Z',
  })
  UpdateDate: Date | null;

  @ApiPropertyOptional({
    description: 'Diupdate oleh',
    nullable: true,
    example: 'admin',
  })
  UpdateBy: string | null;
}

export class PermissionEntity {
  @ApiProperty({ description: 'Permission ID', example: 1 })
  Id: number;

  @ApiProperty({ description: 'Nama aksi permission', example: 'MASTER_READ' })
  Action: string;

  @ApiPropertyOptional({
    description: 'Deskripsi permission',
    nullable: true,
    example: 'Hak akses membaca data master',
  })
  Description: string | null;

  @ApiProperty({
    description: 'Tanggal dibuat',
    example: '2026-01-01T00:00:00.000Z',
  })
  CreateDate: Date;

  @ApiPropertyOptional({
    description: 'Dibuat oleh',
    nullable: true,
    example: 'admin',
  })
  CreateBy: string | null;

  @ApiPropertyOptional({
    description: 'Tanggal update terakhir',
    nullable: true,
    example: '2026-06-14T09:00:00.000Z',
  })
  UpdateDate: Date | null;

  @ApiPropertyOptional({
    description: 'Diupdate oleh',
    nullable: true,
    example: 'admin',
  })
  UpdateBy: string | null;
}
