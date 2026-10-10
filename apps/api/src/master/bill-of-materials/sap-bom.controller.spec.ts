/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SapBomController } from './sap-bom.controller';
import { SapBomPreviewService } from './sap-bom-preview.service';
import { ResponseTransformInterceptor } from '../../common/interceptors/response-transform.interceptor';
import { PERMISSIONS_KEY } from '../../auth/decorators/permission.decorator';

describe('SAP BOM HTTP contract', () => {
  let app: INestApplication;
  const get = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SapBomController],
      providers: [{ provide: SapBomPreviewService, useValue: { get } }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    await app.init();
  });
  afterAll(async () => app.close());
  it('keeps the existing BOM read permission', () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, SapBomController.prototype.get),
    ).toEqual(['IPCS.BOM_REVISION_READ']);
  });
  it('returns the envelope expected by the typed web thunk', async () => {
    const result = {
      finishGoodId: 1,
      partNumber: 'LOCAL',
      sapPartNumber: 'SAP',
      status: 'NOT_FOUND',
      checkedAt: null,
      stale: false,
      bom: null,
    };
    get.mockResolvedValue(result);
    const response = await request(app.getHttpServer())
      .get('/v1/master/bill-of-materials/sap/1')
      .expect(200);
    expect(response.body).toMatchObject({ success: true, data: result });
    expect(get).toHaveBeenCalledWith(1);
  });
  it('rejects nonnumeric FG IDs before accessing the service', async () => {
    get.mockClear();
    await request(app.getHttpServer())
      .get('/v1/master/bill-of-materials/sap/invalid')
      .expect(400);
    expect(get).not.toHaveBeenCalled();
  });
});
