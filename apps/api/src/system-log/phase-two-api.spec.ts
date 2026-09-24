/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { SystemLogController } from './system-log.controller';
import { SystemLogService } from './system-log.service';
import { TransferController } from '../warehouse/transfer/transfer.controller';
import { TransferService } from '../warehouse/transfer/transfer.service';
import { ProductionReportController } from '../production/production-report/production-report.controller';
import { ProductionReportService } from '../production/production-report/production-report.service';
import { ActionAuditService } from '../common/logging/action-audit.service';
import { auditContext } from '../common/helpers/audit-context.helper';
import { requestCommandKey } from '../common/helpers/business-command.helper';

describe('Phase 2 direct API contracts', () => {
  let app: INestApplication;
  const logs = {
    actions: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    events: jest.fn().mockResolvedValue({ data: [], meta: {} }),
  };
  const transfer = {
    transferToRack: jest.fn().mockResolvedValue({ success: true }),
  };
  const report = { create: jest.fn().mockResolvedValue({ Id: 1 }) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        SystemLogController,
        TransferController,
        ProductionReportController,
      ],
      providers: [
        { provide: SystemLogService, useValue: logs },
        { provide: TransferService, useValue: transfer },
        { provide: ProductionReportService, useValue: report },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use(
      (
        req: Request & { user?: { username: string; permissions: string[] } },
        _res: Response,
        next: NextFunction,
      ) => {
        const permission = req.get('x-test-permission');
        if (permission)
          req.user = {
            username: 'verified-test-actor',
            permissions: [permission],
          };
        next();
      },
    );
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('v1');
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('requires read permission for action evidence, including direct URL access', async () => {
    await request(app.getHttpServer())
      .get('/v1/system-log/actions')
      .expect(403);
    await request(app.getHttpServer())
      .get('/v1/system-log/actions?page=1&limit=20&action=REPLAY')
      .set('x-test-permission', 'IPCS.SYSTEM_LOG_READ')
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/system-log/actions?limit=100000')
      .set('x-test-permission', 'IPCS.SYSTEM_LOG_READ')
      .expect(400);
  });
  it('requires read permission and validates unified event queries', async () => {
    await request(app.getHttpServer()).get('/v1/system-log/events').expect(403);
    await request(app.getHttpServer())
      .get('/v1/system-log/events?page=1&limit=100&type=PROCESS&search=test')
      .set('x-test-permission', 'IPCS.SYSTEM_LOG_READ')
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/system-log/events?limit=101&type=OTHER')
      .set('x-test-permission', 'IPCS.SYSTEM_LOG_READ')
      .expect(400);
    expect(logs.events).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 100, type: 'PROCESS' }),
    );
  });
  it('requires a valid command ID and positive integer quantity for transfer', async () => {
    for (const body of [
      { qty: 1 },
      { qty: -1, requestId: 'bad' },
      { qty: 0.5, requestId: '00000000-0000-4000-8000-000000000001' },
    ]) {
      await request(app.getHttpServer())
        .post('/v1/warehouse/material/test/transfer-to-rack')
        .set('x-test-permission', 'IPCS.TRANSFER_CREATE')
        .send(body)
        .expect(400);
    }
    expect(transfer.transferToRack).not.toHaveBeenCalled();
  });
  it('no longer accepts anonymous production report creation', async () => {
    await request(app.getHttpServer())
      .post('/v1/production/production-report')
      .send({})
      .expect(403);
    expect(report.create).not.toHaveBeenCalled();
  });
  it('rejects missing or malformed HTTP command keys before business work', () => {
    expect(() =>
      auditContext.run({ requestId: 'test' }, requestCommandKey),
    ).toThrow('Idempotency-Key');
    expect(() =>
      auditContext.run(
        { requestId: 'test', idempotencyKey: 'not-a-uuid' },
        requestCommandKey,
      ),
    ).toThrow('Idempotency-Key');
  });
  it('records denied attempts without copying credentials, query strings or bodies', async () => {
    const create = jest.fn().mockResolvedValue({});
    const audit = new ActionAuditService({
      actionAuditEvent: { create },
    } as never);
    await audit.failure(
      {
        method: 'POST',
        route: { path: '/restricted/:id' },
        requestId: 'safe-request-id',
        headers: { authorization: 'secret' },
        body: { password: 'secret' },
        originalUrl: '/restricted/a?token=secret',
      } as never,
      403,
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        Action: 'DENIED',
        Actor: null,
        SourceId: '/restricted/:id',
        After: { method: 'POST', statusCode: 403 },
      }),
    });
    expect(JSON.stringify(create.mock.calls)).not.toContain('secret');
  });
  it('records a failed request without an orphan process reference after rollback', async () => {
    const create = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn().mockResolvedValue(null);
    const audit = new ActionAuditService({
      logProcess: { findUnique },
      actionAuditEvent: { create },
    } as never);

    await auditContext.run(
      { requestId: 'rollback-request', processId: 'rolled-back-process' },
      () =>
        audit.failure(
          {
            method: 'POST',
            route: { path: '/inventory/write' },
            requestId: 'rollback-request',
            user: { username: 'operator' },
          } as never,
          500,
        ),
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: { ProcessId: 'rolled-back-process' },
      select: { ProcessId: true },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        Actor: 'operator',
        RequestId: 'rollback-request',
        ProcessId: undefined,
      }),
    });
  });
});
