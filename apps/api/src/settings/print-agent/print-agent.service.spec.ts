import { NotFoundException } from '@nestjs/common';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PrintAgentService } from './print-agent.service';

describe('PrintAgentService admin reads', () => {
  const printAgent = {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };
  const prisma = { printAgent };
  const service = new PrintAgentService(
    prisma as unknown as PrismaService,
    {} as LogProcessService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T10:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('filters and paginates agents while deriving display status', async () => {
    printAgent.count.mockResolvedValue(2);
    printAgent.findMany.mockResolvedValue([
      {
        Id: 'agent-online',
        Name: 'Line A',
        Status: 'ACTIVE',
        LastHeartbeatAt: new Date('2026-09-28T09:59:00.000Z'),
        Version: '1.0.0',
        CreatedAt: new Date(),
        CreatedBy: 'admin',
        UpdatedAt: new Date(),
        UpdatedBy: 'admin',
        _count: { Profiles: 2 },
      },
      {
        Id: 'agent-disabled',
        Name: 'Line B',
        Status: 'DISABLED',
        LastHeartbeatAt: new Date('2026-09-28T09:59:30.000Z'),
        Version: null,
        CreatedAt: new Date(),
        CreatedBy: 'admin',
        UpdatedAt: new Date(),
        UpdatedBy: 'admin',
        _count: { Profiles: 2 },
      },
    ]);

    const result = await service.findAllAgents({
      page: 2,
      limit: 10,
      search: ' line ',
      status: 'ACTIVE',
    });

    expect(result.data.map((agent) => agent.displayStatus)).toEqual([
      'ONLINE',
      'OFFLINE',
    ]);
    expect(result.data.map((agent) => agent.ProfilesCount)).toEqual([2, 2]);
    expect(result.data[0]).not.toHaveProperty('_count');
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      totalItems: 2,
      totalPages: 1,
    });
    expect(printAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({ Status: 'ACTIVE' }),
      }),
    );
  });

  it('returns only safe details and status summaries', async () => {
    printAgent.findUnique.mockResolvedValue({
      Id: 'agent-1',
      Name: 'Line A',
      Status: 'ACTIVE',
      LastHeartbeatAt: new Date('2026-09-28T09:50:00.000Z'),
      Version: '1.0.0',
      CreatedAt: new Date(),
      CreatedBy: 'admin',
      UpdatedAt: new Date(),
      UpdatedBy: 'admin',
      _count: { Profiles: 1 },
      Profiles: [{ Id: 'profile-1', Name: 'Zebra' }],
      Enrollments: [{ Status: 'PENDING' }, { Status: 'CONSUMED' }],
      Credentials: [{ Status: 'ACTIVE' }, { Status: 'ACTIVE' }],
    });

    const result = await service.findOneAgent('agent-1');

    expect(result).toEqual(
      expect.objectContaining({
        displayStatus: 'OFFLINE',
        profileCount: 1,
        enrollmentCount: 2,
        enrollmentStatusCounts: { PENDING: 1, CONSUMED: 1 },
        credentialCount: 2,
        credentialStatusCounts: { ACTIVE: 2 },
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/Hash|Secret|Token|Prefix/);
    expect(printAgent.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          Enrollments: { select: { Status: true } },
          Credentials: { select: { Status: true } },
        }),
      }),
    );
  });

  it('throws when the agent does not exist', async () => {
    printAgent.findUnique.mockResolvedValue(null);

    await expect(service.findOneAgent('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
