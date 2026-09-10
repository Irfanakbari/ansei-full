import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSatuanDto {
  /** Nama satuan (unit of measurement) */
  @ApiProperty({ description: 'Nama satuan', example: 'PCS' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
