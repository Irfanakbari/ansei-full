import { validate } from 'class-validator';
import {
  SupplierBarcodeField,
  UpsertSupplierBarcodeFormatDto,
} from './upsert-supplier-barcode-format.dto';

describe('UpsertSupplierBarcodeFormatDto', () => {
  const validateDto = (
    delimiter: string,
    fields: SupplierBarcodeField[],
    fieldOffsets?: number[],
  ) => {
    const dto = new UpsertSupplierBarcodeFormatDto();
    dto.delimiter = delimiter;
    dto.fields = fields;
    dto.fieldOffsets = fieldOffsets;
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

  it('accepts one non-negative start offset for every field', async () => {
    await expect(
      validateDto(
        ' ',
        [
          SupplierBarcodeField.PART_NUMBER,
          SupplierBarcodeField.QUANTITY,
          SupplierBarcodeField.IGNORE,
        ],
        [11, 0, 0],
      ),
    ).resolves.toHaveLength(0);
  });

  it.each([
    [[11], 'different offset count'],
    [[-1, 0], 'negative offset'],
    [[501, 0], 'offset above limit'],
  ] as const)('rejects %s for %s', async (fieldOffsets) => {
    const errors = await validateDto(
      ' ',
      [SupplierBarcodeField.PART_NUMBER, SupplierBarcodeField.QUANTITY],
      [...fieldOffsets],
    );

    expect(errors.some((error) => error.property === 'fieldOffsets')).toBe(
      true,
    );
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
