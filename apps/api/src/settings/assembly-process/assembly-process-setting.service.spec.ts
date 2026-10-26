import { AssemblyProcessSettingService } from './assembly-process-setting.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

describe('AssemblyProcessSettingService', () => {
  const setting = {
    Id: 1,
    BypassAllAssembly: false,
    ChangeReason: 'Initial disabled state',
    UpdatedAt: new Date('2026-10-26T00:00:00.000Z'),
    UpdatedBy: 'SYSTEM',
  };
  const tx = {
    $executeRaw: jest.fn(),
    assemblyProcessSetting: {
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const prisma = {
    assemblyProcessSetting: {
      findUniqueOrThrow: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const log = {
    startProcess: jest.fn(),
    addLog: jest.fn(),
    completeProcess: jest.fn(),
  };
  const service = new AssemblyProcessSettingService(
    prisma as unknown as PrismaService,
    log as unknown as LogProcessService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.assemblyProcessSetting.findUniqueOrThrow.mockResolvedValue(setting);
    prisma.$transaction.mockImplementation(
      (work: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        work(tx as unknown as Prisma.TransactionClient),
    );
    log.startProcess.mockResolvedValue({ ProcessId: 'audit' });
    tx.assemblyProcessSetting.updateMany.mockResolvedValue({ count: 1 });
    tx.assemblyProcessSetting.findUniqueOrThrow.mockResolvedValue({
      ...setting,
      BypassAllAssembly: true,
      ChangeReason: 'Planned line operation',
      UpdatedBy: 'admin',
    });
  });

  it('reads the singleton setting', async () => {
    await expect(service.find()).resolves.toEqual(setting);
    expect(
      prisma.assemblyProcessSetting.findUniqueOrThrow,
    ).toHaveBeenCalledWith({
      where: { Id: 1 },
    });
  });

  it('updates the singleton with actor, reason, and transactional audit', async () => {
    await service.update(
      {
        bypassAllAssembly: true,
        expectedUpdatedAt: setting.UpdatedAt.toISOString(),
        reason: '  Planned line operation  ',
      },
      'admin',
    );
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.assemblyProcessSetting.updateMany).toHaveBeenCalledWith({
      where: { Id: 1, UpdatedAt: setting.UpdatedAt },
      data: {
        BypassAllAssembly: true,
        ChangeReason: 'Planned line operation',
        UpdatedBy: 'admin',
      },
    });
    expect(log.completeProcess).toHaveBeenCalledWith(
      'audit',
      'SUCCESS',
      undefined,
      tx,
    );
  });

  it('rejects a stale setting snapshot with a conflict', async () => {
    tx.assemblyProcessSetting.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update(
        {
          bypassAllAssembly: true,
          expectedUpdatedAt: setting.UpdatedAt.toISOString(),
          reason: 'Planned line operation',
        },
        'admin',
      ),
    ).rejects.toThrow('changed');
    expect(tx.assemblyProcessSetting.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(log.completeProcess).toHaveBeenLastCalledWith('audit', 'FAILED');
  });

  it('marks audit failed when the setting write rolls back', async () => {
    tx.assemblyProcessSetting.updateMany.mockRejectedValue(
      new Error('write failed'),
    );
    await expect(
      service.update(
        {
          bypassAllAssembly: true,
          expectedUpdatedAt: setting.UpdatedAt.toISOString(),
          reason: 'Planned line operation',
        },
        'admin',
      ),
    ).rejects.toThrow('write failed');
    expect(log.completeProcess).toHaveBeenLastCalledWith('audit', 'FAILED');
  });
});
