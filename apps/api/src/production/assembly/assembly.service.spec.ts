/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
import { BadRequestException } from '@nestjs/common';
import { AssemblyService } from './assembly.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import * as flow from '../../common/helpers/production-flow.helper';
import type { Prisma } from '../../generated/prisma/client';

jest.mock('../../common/helpers/production-flow.helper', () => ({
  lockProductionFlow: jest.fn(),
  assertLabelReady: jest.fn(),
}));
describe('AssemblyService', () => {
  const ready = jest.mocked(flow.assertLabelReady);
  const operator = {
    Uid: 'operator-1',
    Nik: 'NIK-1',
    Name: 'Operator',
    Status: true,
  };
  const label = {
    Id: 1,
    LabelNumber: 'BOX-1',
    RequiresAssembly: true,
    QtyThisBox: 6,
    FinishGoodId: 'FG',
    Scanned: false,
  };
  const session = {
    Id: 'session-1',
    LabelDataId: 1,
    ManPowerUid: operator.Uid,
    Status: 'IN_PROGRESS',
    LabelData: { LabelNumber: label.LabelNumber },
  };
  const dto = {
    manPowerNik: 'NIK-1',
    labelNumber: 'BOX-1',
    requestId: 'request-1',
  };
  const tx = {
    $executeRaw: jest.fn(),
    manPower: { findUnique: jest.fn(), findMany: jest.fn() },
    labelData: { findUnique: jest.fn(), findMany: jest.fn() },
    assemblySession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryLedger: { aggregate: jest.fn(), create: jest.fn() },
    finishGood: { update: jest.fn() },
    stockOpname: { findFirst: jest.fn() },
  };
  const prisma = { ...tx, $transaction: jest.fn() };
  const log = {
    startProcess: jest.fn(),
    addLog: jest.fn(),
    completeProcess: jest.fn(),
  };
  const service = new AssemblyService(
    prisma as unknown as PrismaService,
    log as unknown as LogProcessService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        fn(tx as unknown as Prisma.TransactionClient),
    );
    log.startProcess.mockResolvedValue({ ProcessId: 'audit' });
    tx.manPower.findUnique.mockResolvedValue(operator);
    tx.labelData.findUnique.mockResolvedValue(label);
    ready.mockResolvedValue({ label, forecast: {} } as Awaited<
      ReturnType<typeof flow.assertLabelReady>
    >);
    tx.assemblySession.create.mockResolvedValue(session);
    tx.assemblySession.update.mockResolvedValue({
      ...session,
      Status: 'COMPLETED',
    });
    tx.inventoryLedger.aggregate.mockResolvedValue({
      _sum: { QtyIn: 30, QtyOut: 10 },
    });
  });
  it('lists only ready labels and active idle manpower for creation', async () => {
    tx.labelData.findMany.mockResolvedValue([label, { ...label, Id: 2 }]);
    tx.manPower.findMany.mockResolvedValue([
      { Nik: operator.Nik, Name: operator.Name },
    ]);
    ready.mockRejectedValueOnce(new BadRequestException('Shopping incomplete'));
    const result = await service.createOptions({ labelNumber: 'BOX' });
    expect(result.labels).toEqual([{ ...label, Id: 2 }]);
    expect(tx.labelData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          RequiresAssembly: true,
          ProductionRelease: { Status: 'RELEASED' },
          AssemblySessions: {
            none: { Status: { in: ['IN_PROGRESS', 'COMPLETED'] } },
          },
          LabelNumber: { contains: 'BOX', mode: 'insensitive' },
        }),
        take: 100,
      }),
    );
    expect(tx.manPower.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          Status: true,
          AssemblySessions: { none: { Status: 'IN_PROGRESS' } },
        },
      }),
    );
  });
  it('does not hide infrastructure errors as an empty ready list', async () => {
    tx.labelData.findMany.mockResolvedValue([label]);
    ready.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(service.createOptions({})).rejects.toThrow(
      'Database unavailable',
    );
  });
  it('completes internally using the manpower stored on the session', async () => {
    tx.assemblySession.findUnique
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce(null);
    await service.complete(
      session.Id,
      { requestId: 'internal-complete' },
      'LEADER',
    );
    expect(tx.manPower.findUnique).toHaveBeenCalledWith({
      where: { Uid: session.ManPowerUid },
    });
    expect(tx.assemblySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Status: 'COMPLETED',
          CompletedBy: 'LEADER',
        }),
      }),
    );
  });
  it('starts using validated manpower identity and server timestamp, without stock movement', async () => {
    await service.start(dto, 'DISPLAY', 'DISPLAY');
    expect(tx.assemblySession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ManPowerUid: operator.Uid,
          ManPowerName: operator.Name,
          CreatedBy: 'DISPLAY',
          Channel: 'DISPLAY',
        }),
      }),
    );
    expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
  });
  it('replays start identity without creating another session', async () => {
    tx.assemblySession.findUnique.mockResolvedValue(session);
    await expect(service.start(dto, 'DISPLAY', 'DISPLAY')).resolves.toEqual(
      session,
    );
    expect(tx.assemblySession.create).not.toHaveBeenCalled();
  });
  it('rejects reused start identity for another label', async () => {
    tx.assemblySession.findUnique.mockResolvedValue(session);
    await expect(
      service.start({ ...dto, labelNumber: 'OTHER' }, 'DISPLAY', 'DISPLAY'),
    ).rejects.toThrow('identity');
  });
  it('rejects inactive manpower', async () => {
    tx.manPower.findUnique.mockResolvedValue({ ...operator, Status: false });
    await expect(service.start(dto, 'DISPLAY', 'DISPLAY')).rejects.toThrow(
      'active manpower',
    );
    expect(tx.assemblySession.create).not.toHaveBeenCalled();
  });
  it('rejects incomplete shopping', async () => {
    ready.mockRejectedValue(new Error('Shopping incomplete'));
    await expect(service.start(dto, 'DISPLAY', 'DISPLAY')).rejects.toThrow(
      'Shopping',
    );
  });
  it('rejects passthrough and legacy labels', async () => {
    tx.labelData.findUnique.mockResolvedValue({
      ...label,
      RequiresAssembly: false,
    });
    await expect(service.start(dto, 'DISPLAY', 'DISPLAY')).rejects.toThrow(
      'does not require',
    );
  });
  it('rejects occupied manpower or label', async () => {
    tx.assemblySession.findFirst.mockResolvedValue(session);
    await expect(service.start(dto, 'DISPLAY', 'DISPLAY')).rejects.toThrow(
      'active assembly',
    );
  });
  it('credits only the box quantity from ledger balance, with audit in the same transaction', async () => {
    tx.assemblySession.findUnique.mockResolvedValueOnce(session);
    await service.complete(session.Id, dto, 'DISPLAY');
    expect(tx.inventoryLedger.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ReferenceDoc: 'ASSY-session-1',
        BalanceBefore: 20,
        QtyIn: 6,
        QtyOut: 0,
        BalanceAfter: 26,
      }),
    });
    expect(tx.finishGood.update).toHaveBeenCalledWith({
      where: { PartNumber: 'FG' },
      data: { Qty: 26 },
    });
    expect(log.completeProcess).toHaveBeenCalledWith(
      'audit',
      'SUCCESS',
      undefined,
      tx,
    );
  });
  it('does not credit stock again when completion is retried', async () => {
    tx.assemblySession.findUnique.mockResolvedValue({
      ...session,
      Status: 'COMPLETED',
    });
    await service.complete(session.Id, dto, 'DISPLAY');
    expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
  });
  it('rejects completion by another operator', async () => {
    tx.assemblySession.findUnique.mockResolvedValue({
      ...session,
      ManPowerUid: 'other',
    });
    await expect(service.complete(session.Id, dto, 'DISPLAY')).rejects.toThrow(
      'who started',
    );
  });
  it('rejects a cancelled session', async () => {
    tx.assemblySession.findUnique.mockResolvedValue({
      ...session,
      Status: 'CANCELLED',
    });
    await expect(service.complete(session.Id, dto, 'DISPLAY')).rejects.toThrow(
      'active',
    );
  });
  it('freezes completion during finish good inventory counting', async () => {
    tx.assemblySession.findUnique.mockResolvedValueOnce(session);
    tx.stockOpname.findFirst.mockResolvedValue({
      Id: 'count',
      OpnameNumber: 'IC',
      Category: 'FINISH_GOOD',
      Status: 'IN_PROGRESS',
    });
    await expect(service.complete(session.Id, dto, 'DISPLAY')).rejects.toThrow(
      'Inventory Counting',
    );
    expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
  });
  it('propagates ledger failure without completing the session', async () => {
    tx.assemblySession.findUnique.mockResolvedValueOnce(session);
    tx.inventoryLedger.create.mockRejectedValue(
      new Error('database unavailable'),
    );
    await expect(service.complete(session.Id, dto, 'DISPLAY')).rejects.toThrow(
      'database unavailable',
    );
    expect(tx.assemblySession.update).not.toHaveBeenCalled();
    expect(log.completeProcess).toHaveBeenLastCalledWith('audit', 'FAILED');
  });
  it('cancels with history and no stock mutation', async () => {
    tx.assemblySession.findUnique.mockResolvedValue(session);
    await service.cancel(session.Id, 'Wrong box', 'leader');
    expect(tx.assemblySession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Status: 'CANCELLED',
          CancelReason: 'Wrong box',
          CancelledBy: 'leader',
        }),
      }),
    );
    expect(tx.inventoryLedger.create).not.toHaveBeenCalled();
  });
  it('cannot cancel a completed session', async () => {
    tx.assemblySession.findUnique.mockResolvedValue({
      ...session,
      Status: 'COMPLETED',
    });
    await expect(
      service.cancel(session.Id, 'Wrong box', 'leader'),
    ).rejects.toThrow('active');
  });
});
