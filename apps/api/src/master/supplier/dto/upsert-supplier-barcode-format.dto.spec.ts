import { validate } from 'class-validator';
import {
  SupplierBarcodeField,
  UpsertSupplierBarcodeFormatDto,
} from './upsert-supplier-barcode-format.dto';

describe('UpsertSupplierBarcodeFormatDto', () => {
  const validateDto = (delimiter: string, fields: SupplierBarcodeField[]) => {
    const dto = new UpsertSupplierBarcodeFormatDto();
    dto.delimiter = delimiter;
    dto.fields = fields;
    return validate(dto);
  };

  it.each(['#', '-', ' ', '\\t', '\\n', '|', '::'])(
    'accepts supported delimiter %p',
    async (delimiter) => {
      await expect(
        validateDto(delimiter, [
          SupplierBarcodeField.PART_NUMBER,
          SupplierBarcodeField.QUANTITY,
        ]),
      ).resolves.toHaveLength(0);
    },
  );

  it('requires exactly one part number and quantity field', async () => {
    const errors = await validateDto('#', [
      SupplierBarcodeField.PART_NUMBER,
      SupplierBarcodeField.PART_NUMBER,
      SupplierBarcodeField.QUANTITY,
    ]);

    expect(errors.some((error) => error.property === 'fields')).toBe(true);
  });

  it.each(['', 'abcdef', '\t', '\n'])(
    'rejects delimiter %p',
    async (delimiter) => {
      expect(
        await validateDto(delimiter, [
          SupplierBarcodeField.PART_NUMBER,
          SupplierBarcodeField.QUANTITY,
        ]),
      ).not.toHaveLength(0);
    },
  );
});
