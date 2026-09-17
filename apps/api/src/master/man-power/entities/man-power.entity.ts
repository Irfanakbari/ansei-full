import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ManPower Entity - Man power response format
 */
export class ManPowerEntity {
  @ApiProperty({ description: 'UID karyawan', example: 'uuid-123-abc' })
  Uid: string;

  @ApiProperty({ description: 'NIK karyawan', example: '12345678' })
  Nik: string;

  @ApiProperty({ description: 'Nama karyawan', example: 'Budi Santoso' })
  Name: string;

  @ApiProperty({
    description: 'Tanggal dibuat',
    example: '2026-01-15T08:00:00.000Z',
  })
  CreatedAt: Date;

  @ApiProperty({ description: 'Status aktif', example: true })
  Status: boolean;

  @ApiPropertyOptional({
    description: 'Line produksi',
    nullable: true,
    example: 'LINE-A',
  })
  Line: string | null;

  @ApiPropertyOptional({
    description: 'URL foto karyawan di NAS',
    nullable: true,
    example:
      'http://192.168.1.15:8080/Ansei_Asset/manpower/12345678_1720000000.jpg',
  })
  PicturePath: string | null;

  @ApiPropertyOptional({
    description: 'Skill Matrix',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        Id: { type: 'number', example: 1 },
        Label: { type: 'string', example: 'Assembly A' },
        Point: { type: 'number', example: 3 },
      },
    },
  })
  SkillMatrix?: any[];
}
