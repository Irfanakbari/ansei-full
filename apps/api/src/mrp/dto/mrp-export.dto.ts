import { ApiProperty } from '@nestjs/swagger';

export class MrpExportResponseDto {
  @ApiProperty({ description: 'Excel file buffer as base64' })
  file: string;

  @ApiProperty({ description: 'Filename for download' })
  filename: string;
}
