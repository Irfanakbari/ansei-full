import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSupplierDto {
  /** Nama supplier */
  @ApiProperty({ description: 'Nama supplier', example: 'PT Supplier ABC' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
