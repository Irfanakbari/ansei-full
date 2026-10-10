/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { NotFoundException } from '@nestjs/common';
import { SapBomPreviewService } from './sap-bom-preview.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SapBomService } from '../../common/sap/sap-bom.service';

describe('SapBomPreviewService', () => {
  const findUnique = jest.fn();
  const get = jest.fn();
  const service = new SapBomPreviewService(
    { finishGood: { findUnique } } as unknown as PrismaService,
    { get } as unknown as SapBomService,
  );
  beforeEach(() => jest.resetAllMocks());
  it('uses the same SAP code for different local FG variants', async () => {
    get.mockResolvedValue({
      status: 'NOT_FOUND',
      bom: null,
      checkedAt: null,
      stale: false,
    });
    for (const Id of [1, 2]) {
      findUnique.mockResolvedValueOnce({
        Id,
        PartNumber: `LOCAL-${Id}`,
        PartNumberSAP: ' SAP ',
      });
      expect((await service.get(Id)).sapPartNumber).toBe('SAP');
    }
    expect(get.mock.calls).toEqual([['SAP'], ['SAP']]);
  });
  it('does not guess a SAP code when mapping is missing', async () => {
    findUnique.mockResolvedValue({
      Id: 1,
      PartNumber: 'LOCAL',
      PartNumberSAP: null,
    });
    expect((await service.get(1)).status).toBe('UNMAPPED');
    expect(get).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing local finish good', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.get(999)).rejects.toBeInstanceOf(NotFoundException);
    expect(get).not.toHaveBeenCalled();
  });
});
