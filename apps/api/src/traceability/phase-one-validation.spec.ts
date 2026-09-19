import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateNgCaseDto,
  IssueNgDto,
} from '../production/material-ng-cases/material-ng.dto';
import { TraceQueryDto } from './traceability.dto';
import { commandFingerprint } from '../common/helpers/business-command.helper';

describe('Phase 1 input contracts', () => {
  const requestId = '00000000-0000-4000-8000-000000000001';
  it('accepts a reviewed BOM set with only the damaged components', async () => {
    const dto = plainToInstance(CreateNgCaseDto, {
      requestId,
      forecastId: 'PO',
      snapshotId: requestId,
      stage: 'Assembly',
      reason: 'Damage',
      lines: [
        { materialId: 'A', qtyNg: 2, qtyReplacement: 2 },
        { materialId: 'C', qtyNg: 1, qtyReplacement: 0 },
      ],
    });
    expect(await validate(dto)).toHaveLength(0);
  });
  it('rejects duplicate details and invalid replacement quantities before mutation', async () => {
    const dto = plainToInstance(IssueNgDto, {
      requestId,
      lines: [
        { detailId: 1, qty: 2 },
        { detailId: 1, qty: -1 },
      ],
    });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
  it('validates pagination on the server', async () => {
    expect(
      await validate(
        plainToInstance(TraceQueryDto, { page: '2', limit: '50' }),
      ),
    ).toHaveLength(0);
    expect(
      (await validate(plainToInstance(TraceQueryDto, { page: 0, limit: 1001 })))
        .length,
    ).toBe(2);
  });
  it('canonicalizes equivalent request property order without changing array order', () => {
    expect(commandFingerprint({ a: 1, b: { c: 2, d: 3 } })).toBe(
      commandFingerprint({ b: { d: 3, c: 2 }, a: 1 }),
    );
    expect(commandFingerprint({ lines: [1, 2] })).not.toBe(
      commandFingerprint({ lines: [2, 1] }),
    );
  });
});
