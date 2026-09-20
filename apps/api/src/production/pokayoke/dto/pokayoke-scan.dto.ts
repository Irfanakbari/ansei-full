import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  Max,
  Min,
  IsEnum,
  MaxLength,
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
  @IsEnum(PokayokeCompareStatus)
  status: PokayokeCompareStatus;
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

export class PokayokeScanOptionsQueryDto {
  @ApiProperty({ required: false, description: 'Label number search text' })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  labelNumber?: string;

  @ApiProperty({ required: false, default: 100, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit = 100;
}
