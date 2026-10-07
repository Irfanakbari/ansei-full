import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { NonPoFieldsDto } from './forecast-non-po.dto';
import { withDemandIdentity } from '../../common/interceptors/production-demand.interceptor';

describe('Non PO contract', () => {
  const valid = {
    partNumber: 'FG-TEST',
    deliveryDate: '2026-10-07',
    receivingArea: 'A',
    deliveryPeriod: 1,
    qty: 7,
    poNumber: null,
    notes: null,
  };
  it('accepts an order without a PO number or notes', () => {
    expect(validateSync(plainToInstance(NonPoFieldsDto, valid))).toHaveLength(
      0,
    );
  });
  it.each([
    { qty: 0 },
    { qty: 1.5 },
    { deliveryPeriod: -1 },
    { deliveryPeriod: 1.2 },
    { receivingArea: '   ' },
    { deliveryDate: '2026-02-30' },
    { deliveryDate: '2026-10-07T00:00:00Z' },
  ])('rejects invalid operational fields: %j', (invalid) => {
    expect(
      validateSync(plainToInstance(NonPoFieldsDto, { ...valid, ...invalid }))
        .length,
    ).toBeGreaterThan(0);
  });
  it('preserves legacy response aliases while adding generic identity', () => {
    expect(
      withDemandIdentity({ ProductionDemandId: 'PO-OLD', Qty: 4 }),
    ).toEqual({
      ProductionDemandId: 'PO-OLD',
      ForecastId: 'PO-OLD',
      demandId: 'PO-OLD',
      Qty: 4,
    });
    expect(
      withDemandIdentity({
        PoId: 'NPO-TEST',
        SourceType: 'NON_PO',
        PoNumber: '',
      }),
    ).toMatchObject({
      demandId: 'NPO-TEST',
      sourceType: 'NON_PO',
      referenceNumber: 'NPO-TEST',
      poNumber: null,
    });
  });
  it('does not alter date or binary download objects', () => {
    const date = new Date();
    const binary = Buffer.from('pdf');
    expect(withDemandIdentity(date)).toBe(date);
    expect(withDemandIdentity(binary)).toBe(binary);
  });
});
