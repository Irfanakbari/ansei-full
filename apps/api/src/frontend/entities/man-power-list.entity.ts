import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FrontendSkillMatrixEntity {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiProperty({ example: 'Assembly A' })
  Label: string;

  @ApiProperty({ example: 3 })
  Point: number;
}

export class FrontendManPowerEntity {
  @ApiProperty({ description: 'NIK karyawan', example: '12345678' })
  Nik: string;

  @ApiProperty({ description: 'Nama karyawan', example: 'Budi Santoso' })
  Name: string;

  @ApiPropertyOptional({
    description: 'URL foto karyawan',
    nullable: true,
    example:
      'http://192.168.1.15:8080/Ansei_Asset/manpower/12345678_1720000000.jpg',
  })
  PicturePath: string | null;

  @ApiPropertyOptional({
    description: 'Line produksi',
    nullable: true,
    example: 'LINE-A',
  })
  Line: string | null;

  @ApiPropertyOptional({
    description: 'Skill Matrix',
    type: [FrontendSkillMatrixEntity],
  })
  SkillMatrix?: FrontendSkillMatrixEntity[];
}
