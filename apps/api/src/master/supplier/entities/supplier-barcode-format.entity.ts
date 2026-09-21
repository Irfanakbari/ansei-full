import { ApiProperty } from '@nestjs/swagger';
import { SupplierBarcodeField } from '../dto';

export class SupplierBarcodeFormatEntity {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiProperty({ example: 1 })
  SupplierId: number;

  @ApiProperty({ example: '#' })
  Delimiter: string;

  @ApiProperty({ enum: SupplierBarcodeField, isArray: true })
  Fields: SupplierBarcodeField[];

  @ApiProperty()
  CreatedAt: Date;

  @ApiProperty()
  CreatedBy: string;

  @ApiProperty()
  UpdatedAt: Date;

  @ApiProperty()
  UpdatedBy: string;
}
