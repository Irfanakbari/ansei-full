import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  Max,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PokayokeCompareStatus } from '../../../generated/prisma/enums';

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
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page = 1;
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit = 50;
  @IsString()
  @IsOptional()
  labelNumber?: string;
  @IsString()
  @IsOptional()
  poId?: string;
  @IsOptional()
  @IsEnum(PokayokeCompareStatus)
  status?: PokayokeCompareStatus;
  @IsOptional()
  createdBy?: string;
}
