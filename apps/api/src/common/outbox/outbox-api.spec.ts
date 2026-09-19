import { ResponseTransformInterceptor } from '../interceptors/response-transform.interceptor';
/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { OutboxController } from './outbox.controller';
import { OutboxService } from './outbox.service';
import { SystemLogController } from '../../system-log/system-log.controller';
import { SystemLogService } from '../../system-log/system-log.service';
const id = '00000000-0000-4000-8000-000000000001';
describe('Integration direct API permission and validation', () => {
  let app: INestApplication;
  const service = {
    list: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    summary: jest.fn().mockResolvedValue({ pending: 0 }),
    recover: jest.fn().mockResolvedValue({ id, status: 'PENDING' }),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OutboxController, SystemLogController],
      providers: [
        { provide: OutboxService, useValue: service },
        { provide: SystemLogService, useValue: {} },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    app.use(
      (
        req: Request & { user?: { username: string; permissions: string[] } },
        _res: Response,
        next: NextFunction,
      ) => {
        const permission = req.get('x-test-permission');
        if (permission)
          req.user = { username: 'fixture-actor', permissions: [permission] };
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
  it('requires audit read access and resolves the static integration route before log IDs', async () => {
    await request(app.getHttpServer())
      .get('/v1/system-log/integrations')
      .expect(403);
    await request(app.getHttpServer())
      .get('/v1/system-log/integrations')
      .set('x-test-permission', 'IPCS.SYSTEM_LOG_READ')
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/system-log/integrations/summary')
      .set('x-test-permission', 'IPCS.SYSTEM_LOG_READ')
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/system-log/integrations?limit=10001')
      .set('x-test-permission', 'IPCS.SYSTEM_LOG_READ')
      .expect(400);
  });
  it('prevents a reader from invoking recovery directly', async () => {
    await request(app.getHttpServer())
      .post(`/v1/system-log/integrations/${id}/recover`)
      .set('x-test-permission', 'IPCS.SYSTEM_LOG_READ')
      .send({})
      .expect(403);
    expect(service.recover).not.toHaveBeenCalled();
  });
  it('validates identity, expected attempt, reason, action and unknown fields', async () => {
    const body = {
      requestId: id,
      expectedAttempts: 1,
      reason: 'Restored dependency',
      action: 'RETRY',
    };
    for (const input of [
      { ...body, reason: ' ' },
      { ...body, requestId: 'bad' },
      { ...body, expectedAttempts: -1 },
      { ...body, action: 'RESET' },
      { ...body, password: 'secret' },
      { ...body, outcomeReconciled: 'yes' },
    ]) {
      await request(app.getHttpServer())
        .post(`/v1/system-log/integrations/${id}/recover`)
        .set('x-test-permission', 'IPCS.INTEGRATION_RECOVER')
        .send(input)
        .expect(400);
    }
    await request(app.getHttpServer())
      .post(`/v1/system-log/integrations/${id}/recover`)
      .set('x-test-permission', 'IPCS.INTEGRATION_RECOVER')
      .send(body)
      .expect(201);
    expect(service.recover).toHaveBeenCalledWith(
      id,
      expect.objectContaining(body),
      'fixture-actor',
    );
  });
});
