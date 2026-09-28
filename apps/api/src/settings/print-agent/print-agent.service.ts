import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import type { PrintAgentStatus } from '../../generated/prisma/enums';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreatePrintAgentDto,
  EnrollPrintAgentDto,
  FailPrintJobDto,
  HeartbeatDto,
  LeasePrintJobDto,
  PrintAgentQueryDto,
  PrintJobLeaseDto,
  SyncPrinterProfileDto,
} from './dto/print-agent.dto';
import { PrintFailureCategoryDto } from './dto/print-agent.dto';

const hash = (value: string): string =>
  createHash('sha256').update(value).digest('hex');
const secret = (): string => randomBytes(32).toString('base64url');
const actorFor = (agentId: string): string => `AGENT:${agentId}`;

type Delegate = { [method: string]: (input: object) => Promise<unknown> };
type PrintDb = {
  printAgent: Delegate;
  printAgentEnrollment: Delegate;
  printAgentCredential: Delegate;
  profilePrinter: Delegate;
  printJob: Delegate;
  printJobEvent: Delegate;
  outboxEvent: Delegate;
  actionAuditEvent: Delegate;
  $executeRaw(
    query: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<number>;
  $transaction<T>(fn: (tx: PrintDb) => Promise<T>): Promise<T>;
};
type Row = Record<string, unknown>;
type Count = { count: number };

type PrintAgentBaseRow = {
  Id: string;
  Name: string;
  Status: PrintAgentStatus;
  LastHeartbeatAt: Date | null;
  Version: string | null;
  CreatedAt: Date;
  CreatedBy: string;
  UpdatedAt: Date;
  UpdatedBy: string;
};

type PrintAgentListRow = PrintAgentBaseRow & {
  _count: { Profiles: number };
};

type PrintAgentDetailRow = PrintAgentListRow & {
  Profiles: Array<{
    Id: string;
    ExternalId: string;
    Name: string;
    DocumentType: string;
    Status: string;
    IsDefault: boolean;
    Revision: number;
    SyncedAt: Date;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>;
  Enrollments: Array<{ Status: string }>;
  Credentials: Array<{ Status: string }>;
};

const PRINT_AGENT_OFFLINE_AFTER_MS = 120_000;

const printAgentListSelect = {
  Id: true,
  Name: true,
  Status: true,
  LastHeartbeatAt: true,
  Version: true,
  CreatedAt: true,
  CreatedBy: true,
  UpdatedAt: true,
  UpdatedBy: true,
  _count: { select: { Profiles: true } },
} satisfies Prisma.PrintAgentSelect;

type RuntimeJob = {
  id: string;
  status: string;
  documentType: string;
  payload: unknown;
  profile: unknown;
  attempt: number;
  leaseExpiresAt: Date | null;
  leaseToken?: string;
};

@Injectable()
export class PrintAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: LogProcessService,
  ) {}

  private get db(): PrintDb {
    return this.prisma as unknown as PrintDb;
  }

  async findAllAgents(query: PrintAgentQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.PrintAgentWhereInput = {
      ...(query.status ? { Status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { Name: { contains: search, mode: 'insensitive' } },
              { Id: { contains: search, mode: 'insensitive' } },
              { Version: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, agents] = (await Promise.all([
      this.db.printAgent.count({ where }),
      this.db.printAgent.findMany({
        where,
        select: printAgentListSelect,
        orderBy: { CreatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ])) as [number, PrintAgentListRow[]];

    return {
      data: agents.map(({ _count, ...agent }) => ({
        ...this.withDisplayStatus(agent),
        ProfilesCount: _count.Profiles,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOneAgent(id: string) {
    const agent = (await this.db.printAgent.findUnique({
      where: { Id: id },
      select: {
        ...printAgentListSelect,
        Profiles: {
          select: {
            Id: true,
            ExternalId: true,
            Name: true,
            DocumentType: true,
            Status: true,
            IsDefault: true,
            Revision: true,
            SyncedAt: true,
            CreatedAt: true,
            UpdatedAt: true,
          },
          orderBy: { Name: 'asc' },
        },
        Enrollments: { select: { Status: true } },
        Credentials: { select: { Status: true } },
      },
    })) as PrintAgentDetailRow | null;
    if (!agent) throw new NotFoundException('Print agent not found');

    const { Profiles, Enrollments, Credentials, _count, ...safeAgent } = agent;
    return {
      ...this.withDisplayStatus(safeAgent),
      ProfilesCount: _count.Profiles,
      profileCount: Profiles.length,
      profiles: Profiles,
      enrollmentCount: Enrollments.length,
      enrollmentStatusCounts: this.statusCounts(Enrollments),
      credentialCount: Credentials.length,
      credentialStatusCounts: this.statusCounts(Credentials),
    };
  }

  async createAgent(dto: CreatePrintAgentDto, actor: string): Promise<unknown> {
    const log = await this.logs.startProcess({
      functionId: 'PRINT_AGENT_CREATE',
      functionName: 'PrintAgentService.createAgent',
      createdBy: actor,
    });
    try {
      const result = await this.db.printAgent.create({
        data: { Name: dto.name, CreatedBy: actor, UpdatedBy: actor },
      });
      await this.logs.addLog({
        processId: log.ProcessId,
        message: 'Print agent created',
        type: 'INFO',
        location: 'print-agent.service.ts:createAgent',
      });
      await this.logs.completeProcess(log.ProcessId, 'SUCCESS');
      return result;
    } catch (error) {
      await this.logs.completeProcess(log.ProcessId, 'FAILED');
      throw error;
    }
  }

  async issueEnrollment(
    agentId: string,
    actor: string,
  ): Promise<{ token: string; expiresAt: null }> {
    const log = await this.logs.startProcess({
      functionId: 'PRINT_AGENT_ENROLLMENT',
      functionName: 'PrintAgentService.issueEnrollment',
      createdBy: actor,
    });
    try {
      const token = secret();
      await this.db.$transaction(async (tx) => {
        await tx.printAgentEnrollment.updateMany({
          where: { AgentId: agentId, Status: 'PENDING' },
          data: { Status: 'REVOKED' },
        });
        await tx.printAgentEnrollment.create({
          data: {
            AgentId: agentId,
            TokenHash: hash(token),
            TokenPrefix: token.slice(0, 12),
            ExpiresAt: null,
            CreatedBy: actor,
          },
        });
      });
      await this.logs.completeProcess(
        log.ProcessId,
        'SUCCESS',
        'Enrollment issued',
      );
      return { token, expiresAt: null };
    } catch (error) {
      await this.logs.completeProcess(log.ProcessId, 'FAILED');
      throw error;
    }
  }

  async enroll(
    dto: EnrollPrintAgentDto,
  ): Promise<{ agentId: string; secret: string }> {
    const tokenHash = hash(dto.token);
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const enrollment = (await tx.printAgentEnrollment.findFirst({
        where: {
          TokenHash: tokenHash,
          Status: 'PENDING',
          OR: [{ ExpiresAt: null }, { ExpiresAt: { gt: now } }],
          Agent: { Status: 'ACTIVE' },
        },
      })) as Row | null;
      if (!enrollment)
        throw new UnauthorizedException('Invalid or expired enrollment token');
      const claimed = (await tx.printAgentEnrollment.updateMany({
        where: {
          Id: enrollment.Id,
          Status: 'PENDING',
          OR: [{ ExpiresAt: null }, { ExpiresAt: { gt: now } }],
          Agent: { Status: 'ACTIVE' },
        },
        data: { Status: 'CONSUMED', ConsumedAt: now },
      })) as Count;
      if (claimed.count !== 1)
        throw new ConflictException('Enrollment token is no longer valid');
      const rawSecret = secret();
      await tx.printAgentCredential.create({
        data: {
          AgentId: enrollment.AgentId,
          SecretHash: hash(rawSecret),
          SecretPrefix: rawSecret.slice(0, 12),
          CreatedBy: 'ENROLLMENT',
        },
      });
      const active = (await tx.printAgent.updateMany({
        where: { Id: enrollment.AgentId, Status: 'ACTIVE' },
        data: { Version: dto.version, UpdatedBy: 'ENROLLMENT' },
      })) as Count;
      if (active.count !== 1)
        throw new ConflictException('Print agent is no longer active');
      await this.audit(
        tx,
        'PRINT_AGENT_ENROLL',
        'PrintAgentEnrollment',
        String(enrollment.Id),
        'ENROLLED',
        'ENROLLMENT',
      );
      return { agentId: String(enrollment.AgentId), secret: rawSecret };
    });
  }

  async heartbeat(
    agentId: string,
    dto: HeartbeatDto,
  ): Promise<{ agentId: string; acceptedAt: Date }> {
    const acceptedAt = new Date();
    await this.db.$transaction(async (tx) => {
      const updated = (await tx.printAgent.updateMany({
        where: { Id: agentId, Status: 'ACTIVE' },
        data: {
          LastHeartbeatAt: acceptedAt,
          Version: dto.version,
          Metadata: dto.metadata,
          UpdatedBy: actorFor(agentId),
        },
      })) as Count;
      if (updated.count !== 1)
        throw new NotFoundException('Active print agent not found');
      await this.audit(
        tx,
        'PRINT_AGENT_HEARTBEAT',
        'PrintAgent',
        agentId,
        'HEARTBEAT',
        actorFor(agentId),
      );
    });
    return { agentId, acceptedAt };
  }

  async syncProfile(
    agentId: string,
    dto: SyncPrinterProfileDto,
  ): Promise<{
    id: string;
    externalId: string;
    isDefault: boolean;
    revision: number;
  }> {
    try {
      return await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.documentType}))`;
        const existing = (await tx.profilePrinter.findUnique({
          where: {
            AgentId_ExternalId: {
              AgentId: agentId,
              ExternalId: dto.externalId,
            },
          },
        })) as Row | null;
        const requestedDefault = dto.isDefault ?? existing?.IsDefault === true;
        const activeDefault = (await tx.profilePrinter.findFirst({
          where: {
            DocumentType: dto.documentType,
            Status: 'READY',
            IsDefault: true,
          },
        })) as Row | null;
        if (!requestedDefault && !activeDefault)
          throw new ConflictException('A ready default profile is required');
        if (existing?.IsDefault === true && dto.isDefault === false)
          throw new ConflictException(
            'Select another default before demoting this profile',
          );
        if (requestedDefault)
          await tx.profilePrinter.updateMany({
            where: {
              DocumentType: dto.documentType,
              Status: 'READY',
              IsDefault: true,
              ...(existing ? { Id: { not: existing.Id } } : {}),
            },
            data: { IsDefault: false },
          });
        const profile = (await tx.profilePrinter.upsert({
          where: {
            AgentId_ExternalId: {
              AgentId: agentId,
              ExternalId: dto.externalId,
            },
          },
          create: {
            AgentId: agentId,
            ExternalId: dto.externalId,
            Name: dto.name,
            DocumentType: dto.documentType,
            IsDefault: requestedDefault,
            Revision: dto.revision,
            ProfileSnapshot: dto.profile,
            SyncedAt: new Date(),
          },
          update: {
            Name: dto.name,
            DocumentType: dto.documentType,
            Status: 'READY',
            IsDefault: requestedDefault,
            Revision: dto.revision,
            ProfileSnapshot: dto.profile,
            SyncedAt: new Date(),
          },
        })) as Row;
        await this.audit(
          tx,
          'PRINT_PROFILE_SYNC',
          'ProfilePrinter',
          String(profile.Id),
          'SYNCED',
          actorFor(agentId),
        );
        return {
          id: String(profile.Id),
          externalId: String(profile.ExternalId),
          isDefault: profile.IsDefault === true,
          revision: Number(profile.Revision),
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Default profile changed concurrently');
      throw error;
    }
  }

  async lease(
    agentId: string,
    dto: LeasePrintJobDto,
  ): Promise<RuntimeJob | null> {
    const seconds = dto.leaseSeconds ?? 60;
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const job = (await tx.printJob.findFirst({
        where: { AgentId: agentId, Status: 'QUEUED' },
        orderBy: { CreatedAt: 'asc' },
      })) as Row | null;
      if (!job) return null;
      const leaseToken = secret();
      const expiresAt = new Date(now.getTime() + seconds * 1000);
      const claimed = (await tx.printJob.updateMany({
        where: { Id: job.Id, Status: 'QUEUED', LeaseTokenHash: null },
        data: {
          Status: 'LEASED',
          LeaseTokenHash: hash(leaseToken),
          LeaseExpiresAt: expiresAt,
          Attempt: { increment: 1 },
        },
      })) as Count;
      if (claimed.count !== 1) return null;
      const leased = (await tx.printJob.findUnique({
        where: { Id: job.Id },
      })) as Row;
      await tx.printJobEvent.create({
        data: {
          JobId: job.Id,
          AgentId: agentId,
          Type: 'LEASED',
          FromStatus: 'QUEUED',
          ToStatus: 'LEASED',
          Attempt: leased.Attempt,
        },
      });
      await this.audit(
        tx,
        'PRINT_JOB_LEASE',
        'PrintJob',
        String(job.Id),
        'LEASED',
        actorFor(agentId),
      );
      return this.runtimeJob(leased, leaseToken);
    });
  }

  renew(
    agentId: string,
    id: string,
    dto: PrintJobLeaseDto,
  ): Promise<RuntimeJob> {
    return this.transition(
      agentId,
      id,
      dto.leaseToken,
      ['LEASED', 'DOWNLOADED'],
      undefined,
      'RENEWED',
      {
        LeaseExpiresAt: new Date(Date.now() + (dto.leaseSeconds ?? 60) * 1000),
      },
    );
  }

  downloaded(
    agentId: string,
    id: string,
    dto: PrintJobLeaseDto,
  ): Promise<RuntimeJob> {
    return this.transition(
      agentId,
      id,
      dto.leaseToken,
      ['LEASED'],
      'DOWNLOADED',
      'DOWNLOADED',
      { DownloadedAt: new Date() },
    );
  }

  spooling(
    agentId: string,
    id: string,
    dto: PrintJobLeaseDto,
  ): Promise<RuntimeJob> {
    return this.transition(
      agentId,
      id,
      dto.leaseToken,
      ['LEASED', 'DOWNLOADED'],
      'SPOOLING',
      'SPOOLING',
      { SpoolingAt: new Date() },
    );
  }

  succeeded(
    agentId: string,
    id: string,
    dto: PrintJobLeaseDto,
  ): Promise<RuntimeJob> {
    return this.transition(
      agentId,
      id,
      dto.leaseToken,
      ['SPOOLING'],
      'SUCCEEDED',
      'SUCCEEDED',
      {
        SucceededAt: new Date(),
        LeaseTokenHash: null,
        LeaseExpiresAt: null,
      },
      {
        Status: 'SUCCEEDED',
        SucceededAt: new Date(),
        FailedAt: null,
        LastErrorCode: 'OUTBOX_TRANSPORT_ACCEPTED',
        LastError: null,
      },
    );
  }

  failed(
    agentId: string,
    id: string,
    dto: FailPrintJobDto,
  ): Promise<RuntimeJob> {
    const uncertain =
      dto.category === PrintFailureCategoryDto.DELIVERY_UNCERTAIN;
    return this.transition(
      agentId,
      id,
      dto.leaseToken,
      uncertain
        ? ['LEASED', 'DOWNLOADED', 'SPOOLING']
        : ['LEASED', 'DOWNLOADED'],
      uncertain ? 'UNCERTAIN' : 'FAILED',
      'FAILED',
      {
        FailedAt: new Date(),
        ErrorCode: dto.code,
        ErrorMessage: dto.message,
        LeaseTokenHash: null,
        LeaseExpiresAt: null,
      },
      {
        Status: 'FAILED',
        FailedAt: new Date(),
        LastErrorCode: uncertain
          ? 'OUTBOX_DELIVERY_UNCERTAIN'
          : 'OUTBOX_SAFE_RETRY',
        LastError: dto.message,
      },
    );
  }

  async reapExpiredLeases(): Promise<number> {
    const candidates = (await this.db.printJob.findMany({
      where: {
        Status: { in: ['LEASED', 'DOWNLOADED', 'SPOOLING'] },
        LeaseExpiresAt: { lte: new Date() },
      },
      select: { Id: true },
      take: 100,
    })) as Row[];
    let reaped = 0;
    for (const candidate of candidates) {
      const changed = await this.db.$transaction(async (tx) => {
        const now = new Date();
        const current = (await tx.printJob.findFirst({
          where: {
            Id: candidate.Id,
            Status: { in: ['LEASED', 'DOWNLOADED', 'SPOOLING'] },
            LeaseExpiresAt: { lte: now },
          },
        })) as Row | null;
        if (!current) return false;
        const uncertain = current.Status === 'SPOOLING';
        const target = uncertain ? 'UNCERTAIN' : 'FAILED';
        const result = (await tx.printJob.updateMany({
          where: {
            Id: current.Id,
            Status: current.Status,
            LeaseExpiresAt: current.LeaseExpiresAt,
          },
          data: {
            Status: target,
            FailedAt: now,
            ErrorCode: 'LEASE_EXPIRED',
            ErrorMessage: 'Print job lease expired',
            LeaseTokenHash: null,
            LeaseExpiresAt: null,
          },
        })) as Count;
        if (result.count !== 1) return false;
        await tx.printJobEvent.create({
          data: {
            JobId: current.Id,
            AgentId: current.AgentId,
            Type: 'LEASE_EXPIRED',
            FromStatus: current.Status,
            ToStatus: target,
            Attempt: current.Attempt,
          },
        });
        await tx.outboxEvent.updateMany({
          where: {
            Id: current.OutboxEventId,
            Status: { in: ['QUEUED', 'PROCESSING'] },
          },
          data: {
            Status: 'FAILED',
            FailedAt: now,
            LastErrorCode: uncertain
              ? 'OUTBOX_DELIVERY_UNCERTAIN'
              : 'OUTBOX_SAFE_RETRY',
            LastError: 'Print job lease expired',
          },
        });
        await this.audit(
          tx,
          'PRINT_JOB_LEASE_EXPIRED',
          'PrintJob',
          String(current.Id),
          'LEASE_EXPIRED',
          'SYSTEM:PRINT_LEASE_REAPER',
        );
        return true;
      });
      if (changed) reaped += 1;
    }
    return reaped;
  }

  private transition(
    agentId: string,
    id: string,
    leaseToken: string,
    statuses: string[],
    target: string | undefined,
    eventType: string,
    data: Row,
    outboxData?: Row,
  ): Promise<RuntimeJob> {
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const tokenHash = hash(leaseToken);
      const current = (await tx.printJob.findFirst({
        where: {
          Id: id,
          AgentId: agentId,
          Status: { in: statuses },
          LeaseTokenHash: tokenHash,
          LeaseExpiresAt: { gt: now },
        },
      })) as Row | null;
      if (!current)
        throw new ConflictException(
          'Lease is expired, stale, or job state is invalid',
        );
      const nextStatus = target ?? String(current.Status);
      const changed = (await tx.printJob.updateMany({
        where: {
          Id: id,
          AgentId: agentId,
          Status: current.Status,
          LeaseTokenHash: tokenHash,
          LeaseExpiresAt: current.LeaseExpiresAt,
        },
        data: { ...data, ...(target ? { Status: target } : {}) },
      })) as Count;
      if (changed.count !== 1)
        throw new ConflictException('Lease was concurrently changed');
      await tx.printJobEvent.create({
        data: {
          JobId: id,
          AgentId: agentId,
          Type: eventType,
          FromStatus: current.Status,
          ToStatus: nextStatus,
          Attempt: current.Attempt,
        },
      });
      if (outboxData) {
        const outboxChanged = (await tx.outboxEvent.updateMany({
          where: {
            Id: current.OutboxEventId,
            Status: { in: ['QUEUED', 'PROCESSING'] },
          },
          data: outboxData,
        })) as Count;
        if (outboxChanged.count !== 1)
          throw new ConflictException(
            'Originating outbox event is no longer active',
          );
      }
      await this.audit(
        tx,
        `PRINT_JOB_${eventType}`,
        'PrintJob',
        id,
        eventType,
        actorFor(agentId),
      );
      const updated = (await tx.printJob.findUnique({
        where: { Id: id },
      })) as Row;
      return this.runtimeJob(updated);
    });
  }

  private runtimeJob(row: Row, leaseToken?: string): RuntimeJob {
    return {
      id: String(row.Id),
      status: String(row.Status),
      documentType: String(row.DocumentType),
      payload: row.PayloadSnapshot,
      profile: row.ProfileSnapshot,
      attempt: Number(row.Attempt),
      leaseExpiresAt:
        row.LeaseExpiresAt instanceof Date ? row.LeaseExpiresAt : null,
      ...(leaseToken ? { leaseToken } : {}),
    };
  }

  private async audit(
    tx: PrintDb,
    functionId: string,
    sourceType: string,
    sourceId: string,
    action: string,
    actor: string,
  ): Promise<void> {
    const log = await this.logs.startProcess({
      functionId,
      functionName: `PrintAgentService.${action}`,
      createdBy: actor,
      client: tx as never,
    });
    await this.logs.completeProcess(
      log.ProcessId,
      'SUCCESS',
      `${action} ${sourceType} ${sourceId}`,
      tx as never,
    );
    await tx.actionAuditEvent.create({
      data: {
        SourceType: sourceType,
        SourceId: sourceId,
        Action: action,
        Actor: actor,
        ActorSource: actor.startsWith('SYSTEM:')
          ? 'SYSTEM_WORKER'
          : 'AUTHENTICATED_COMMAND',
        ProcessId: log.ProcessId,
      },
    });
  }

  private withDisplayStatus<T extends PrintAgentBaseRow>(agent: T) {
    const online =
      agent.Status === 'ACTIVE' &&
      agent.LastHeartbeatAt !== null &&
      Date.now() - agent.LastHeartbeatAt.getTime() <=
        PRINT_AGENT_OFFLINE_AFTER_MS;
    return { ...agent, displayStatus: online ? 'ONLINE' : 'OFFLINE' } as const;
  }

  private statusCounts(
    items: Array<{ Status: string }>,
  ): Record<string, number> {
    return items.reduce<Record<string, number>>((counts, item) => {
      counts[item.Status] = (counts[item.Status] ?? 0) + 1;
      return counts;
    }, {});
  }

  async requireAgent(id: string): Promise<void> {
    const agent = await this.db.printAgent.findUnique({ where: { Id: id } });
    if (!agent) throw new NotFoundException('Print agent not found');
  }
}
