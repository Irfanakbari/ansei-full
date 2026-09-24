import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, Min, IsEnum } from 'class-validator';
import { LocationType } from '../../../generated/prisma/enums';

export class TransferMaterialStockDto {
  @ApiProperty({
    description: 'Part number asal yang akan dikurangi stoknya',
    example: 'MAT-001',
  })
  @IsString()
  @IsNotEmpty()
  sourcePartNumber: string;

  @ApiProperty({
    description: 'Part number tujuan yang akan ditambah stoknya',
    example: 'MAT-002',
  })
  @IsString()
  @IsNotEmpty()
  targetPartNumber: string;

  @ApiProperty({
    description: 'Lokasi stok yang ditransfer (WAREHOUSE atau RACK)',
    enum: LocationType,
    example: LocationType.WAREHOUSE,
  })
  @IsEnum(LocationType)
  location: LocationType;

  @ApiProperty({
    description: 'Jumlah stok yang ditransfer',
    example: 50,
  })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiProperty({
    description: 'Alasan transfer stok / supersession',
    example: 'Supersession ke part number baru MAT-002',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
