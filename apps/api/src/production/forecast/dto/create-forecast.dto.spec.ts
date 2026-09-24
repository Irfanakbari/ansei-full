/* By Irfan Akbari Vuteq Indonesia - 2026-09-24 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateForecastDto } from './create-forecast.dto';

const validPayload = {
  poId: 'PO-001',
  date: '2026-09-24T00:00:00.000Z',
  vendorCode: 'EXT-VENDOR',
  vendorName: 'Extreme Customer',
  receivingArea: 'EXT-DOCK',
  deliveryDate: '2026-09-25T00:00:00.000Z',
  deliveryPeriod: 1,
  classification: 'REGULER',
  poNumber: 'EXT-CUSTOMER-PO-1',
  item: 1,
  qty: 12,
  finishGoodId: 'EXT-FG-ASSY',
};

describe(CreateForecastDto.name, () => {
  it('accepts ISO date strings after the production implicit transform', async () => {
    const dto = plainToInstance(CreateForecastDto, validPayload, {
      enableImplicitConversion: true,
    });

    expect(dto.date).toBe(validPayload.date);
    expect(dto.deliveryDate).toBe(validPayload.deliveryDate);
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid date strings', async () => {
    const dto = plainToInstance(
      CreateForecastDto,
      { ...validPayload, date: 'not-a-date', deliveryDate: 'also-invalid' },
      { enableImplicitConversion: true },
    );

    const errors = await validate(dto);
    expect(errors.map((error) => error.property).sort()).toEqual([
      'date',
      'deliveryDate',
    ]);
  });
});
