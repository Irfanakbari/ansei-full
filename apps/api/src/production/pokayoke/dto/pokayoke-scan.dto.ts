import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreatePokayokeScanDto {
  @ApiProperty({
    description: 'Label Number to scan',
    example: 'PO-00100100005',
  })
  @IsString()
  @IsNotEmpty()
  labelNumber: string;

  @ApiProperty({
    description: 'Scan result status (SUKSES = success, GAGAL = failed)',
    example: 'SUKSES',
  })
  @IsString()
  @IsNotEmpty()
  status: string; // 'SUKSES' or 'GAGAL'
}

export class PokayokeScanQueryDto {
  @IsNumber()
  @IsOptional()
  page?: number = 1;
  @IsNumber()
  @IsOptional()
  limit?: number = 50;
  @IsString()
  @IsOptional()
  labelNumber?: string;
  @IsString()
  @IsOptional()
  poId?: string;
  @IsOptional()
  status?: string;
  @IsOptional()
  createdBy?: string;
}
