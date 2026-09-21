import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsString,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export enum SupplierBarcodeField {
  PART_NUMBER = 'PART_NUMBER',
  PART_NAME = 'PART_NAME',
  QUANTITY = 'QUANTITY',
  DATE = 'DATE',
  IGNORE = 'IGNORE',
}

@ValidatorConstraint({ name: 'supplierBarcodeRequiredFields', async: false })
class SupplierBarcodeRequiredFieldsConstraint implements ValidatorConstraintInterface {
  validate(fields: unknown): boolean {
    if (!Array.isArray(fields)) return false;
    return (
      fields.filter((field) => field === SupplierBarcodeField.PART_NUMBER)
        .length === 1 &&
      fields.filter((field) => field === SupplierBarcodeField.QUANTITY)
        .length === 1
    );
  }

  defaultMessage(): string {
    return 'fields must contain exactly one PART_NUMBER and exactly one QUANTITY';
  }
}

export class UpsertSupplierBarcodeFormatDto {
  @ApiProperty({
    description:
      "Field delimiter: '#', '-', one space, escaped \\t/\\n, or a custom delimiter up to 5 characters",
    examples: ['#', '-', ' ', '\\t', '\\n', '|'],
  })
  @IsString()
  @Matches(/^(?:#|-| |\\t|\\n|[^\s#-]{1,5})$/, {
    message:
      "delimiter must be '#', '-', one space, escaped \\t/\\n, or a custom delimiter up to 5 characters",
  })
  delimiter: string;

  @ApiProperty({
    enum: SupplierBarcodeField,
    isArray: true,
    example: [
      SupplierBarcodeField.PART_NUMBER,
      SupplierBarcodeField.IGNORE,
      SupplierBarcodeField.QUANTITY,
    ],
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsEnum(SupplierBarcodeField, { each: true })
  @Validate(SupplierBarcodeRequiredFieldsConstraint)
  fields: SupplierBarcodeField[];
}
