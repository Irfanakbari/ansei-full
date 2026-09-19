import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Request, Response, NextFunction } from 'express';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { TraceabilityController } from './traceability.controller';
import { TraceabilityService } from './traceability.service';
import { BomRevisionsController } from '../master/bom-revisions/bom-revisions.controller';
import { BomRevisionsService } from '../master/bom-revisions/bom-revisions.service';
import { MaterialNgController } from '../production/material-ng-cases/material-ng.controller';
import { MaterialNgService } from '../production/material-ng-cases/material-ng.service';

describe('Phase 1 direct API authorization', () => {
  let app: INestApplication;
  const trace = { search: jest.fn().mockResolvedValue({ data: [] }) };
  const bom = { action: jest.fn() };
  const ng = { issue: jest.fn() };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        TraceabilityController,
        BomRevisionsController,
        MaterialNgController,
      ],
      providers: [
        { provide: TraceabilityService, useValue: trace },
        { provide: BomRevisionsService, useValue: bom },
        { provide: MaterialNgService, useValue: ng },
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
        const permission = req.header('x-test-permission');
        if (permission)
          req.user = { username: 'test-reader', permissions: [permission] };
        next();
      },
    );
    app.setGlobalPrefix('v1');
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each([
    ['get', '/v1/traceability/search'],
    [
      'post',
      '/v1/master/bom-revisions/00000000-0000-4000-8000-000000000001/approve',
    ],
    [
      'post',
      '/v1/production/material-ng-cases/00000000-0000-4000-8000-000000000001/issue',
    ],
  ] as const)('denies %s %s without permission', async (method, path) => {
    await request(app.getHttpServer())[method](path).expect(403);
    expect(trace.search).not.toHaveBeenCalled();
    expect(bom.action).not.toHaveBeenCalled();
    expect(ng.issue).not.toHaveBeenCalled();
  });
  it('allows a trace reader but denies their direct approval request', async () => {
    await request(app.getHttpServer())
      .get('/v1/traceability/search')
      .set('x-test-permission', 'IPCS.TRACEABILITY_READ')
      .expect(200);
    await request(app.getHttpServer())
      .post(
        '/v1/master/bom-revisions/00000000-0000-4000-8000-000000000001/approve',
      )
      .set('x-test-permission', 'IPCS.TRACEABILITY_READ')
      .expect(403);
    expect(trace.search).toHaveBeenCalledTimes(1);
    expect(bom.action).not.toHaveBeenCalled();
  });
});
