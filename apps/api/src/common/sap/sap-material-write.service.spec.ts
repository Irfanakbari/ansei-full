/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import {
  materialSapValues,
  SapMaterialWriteService,
} from './sap-material-write.service';
describe('SAP material worker', () => {
  const current = {
    Id: 1,
    PartNumber: 'LOCAL',
    PartNumberSAP: 'SAP',
    PartName: 'Name',
    MinimumStock: 0,
    MaximumStock: 0,
  };
  function fixture() {
    const updateMaterial = jest.fn();
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
      material: { findUnique: jest.fn().mockResolvedValue(current) },
    };
    const db = { $transaction: jest.fn((work) => work(tx)) };
    return {
      tx,
      updateMaterial,
      worker: new SapMaterialWriteService(
        db as never,
        { updateMaterial } as never,
      ),
    };
  }
  it('serializes SAP sends and sends zero limits using the SAP mapping', async () => {
    const f = fixture();
    expect(await f.worker.send(materialSapValues(current))).toBe('SENT');
    expect(f.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(f.updateMaterial).toHaveBeenCalledWith(
      'SAP',
      materialSapValues(current),
    );
  });
  it('never sends a stale name or stale mapping', async () => {
    const f = fixture();
    expect(
      await f.worker.send({ ...materialSapValues(current), partName: 'Old' }),
    ).toBe('SUPERSEDED');
    expect(
      await f.worker.send({
        ...materialSapValues(current),
        itemCode: 'OLD-SAP',
      }),
    ).toBe('SUPERSEDED');
    expect(f.updateMaterial).not.toHaveBeenCalled();
  });
  it('defers competing sends without locking material or stock rows', async () => {
    const f = fixture();
    f.tx.$queryRaw.mockResolvedValue([{ locked: false }]);
    await expect(f.worker.send(materialSapValues(current))).rejects.toThrow(
      'being synchronized',
    );
    expect(f.updateMaterial).not.toHaveBeenCalled();
  });
  it('does not send deleted or malformed materials', async () => {
    const f = fixture();
    f.tx.material.findUnique.mockResolvedValue(null);
    expect(await f.worker.send(materialSapValues(current))).toBe('SUPERSEDED');
    await expect(f.worker.send({ materialId: 1 })).rejects.toThrow();
    expect(f.updateMaterial).not.toHaveBeenCalled();
  });
  it('uses PartNumber for missing or blank SAP mapping', () => {
    expect(
      materialSapValues({ ...current, PartNumberSAP: null }).itemCode,
    ).toBe('LOCAL');
    expect(materialSapValues({ ...current, PartNumberSAP: ' ' }).itemCode).toBe(
      'LOCAL',
    );
  });
  it('propagates a failed send for durable outbox retry', async () => {
    const f = fixture();
    f.updateMaterial.mockRejectedValue(new Error('Unavailable'));
    await expect(f.worker.send(materialSapValues(current))).rejects.toThrow(
      'Unavailable',
    );
  });
});
