import { ApiProperty } from '@nestjs/swagger';

export class UserEntity {
  @ApiProperty({ description: 'User ID', example: 'admin001' })
  UserId: string;

  @ApiProperty({ description: 'Nama user', example: 'Administrator' })
  Name: string;

  @ApiProperty({
    description: 'Email user',
    required: false,
    nullable: true,
    example: 'admin@ansei.co.id',
  })
  Email: string | null;

  @ApiProperty({
    description: 'Waktu login terakhir',
    required: false,
    nullable: true,
    example: '2026-06-14T09:00:00.000Z',
  })
  LastLogin: Date | null;

  @ApiProperty({
    description: 'Nama role',
    required: false,
    nullable: true,
    example: 'SUPER',
  })
  RoleName: string | null;

  @ApiProperty({
    description: 'Daftar permission user',
    required: false,
    nullable: true,
    example: ['MASTER_READ', 'MASTER_CREATE', 'PRODUCTION_READ'],
  })
  Permission: string[] | null;
}
