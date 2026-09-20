import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DisplayConfigEntity {
  @ApiProperty({ description: 'ID display config', example: 1 })
  id: number;

  @ApiProperty({
    description: 'Deskripsi display',
    example: 'Display Utama Gudang',
  })
  description: string;

  @ApiPropertyOptional({
    description: 'URL display',
    example: 'https://display.example.com/screen/1',
    nullable: true,
  })
  url: string | null;

  @ApiPropertyOptional({
    description: 'Uploaded NAS media URL',
    nullable: true,
  })
  filePath: string | null;

  @ApiPropertyOptional({ description: 'Production line', nullable: true })
  line: string | null;

  @ApiProperty({ description: 'Status open/close', example: false })
  isOpen: boolean;

  @ApiProperty({ description: 'Loop otomatis', example: true })
  loop: boolean;

  @ApiPropertyOptional({
    description: 'Tanggal dibuat',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt: Date | null;

  @ApiProperty({
    description: 'Tanggal diupdate',
    example: '2026-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty()
  createdBy: string;

  @ApiProperty()
  updatedBy: string;
}
