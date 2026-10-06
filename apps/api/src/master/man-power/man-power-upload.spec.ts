/* By Irfan Akbari Vuteq Indonesia - 2026-10-06 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ManPowerController } from './man-power.controller';
import { ManPowerService } from './man-power.service';

describe('ManPower picture multipart transport', () => {
  let app: INestApplication;
  const uploadPicture = jest
    .fn()
    .mockResolvedValue({ PicturePath: '/test.png' });
  const path = '/v1/master/man-power/test-uid/picture';
  const png = Buffer.from('89504e470d0a1a0a', 'hex');

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ManPowerController],
      providers: [{ provide: ManPowerService, useValue: { uploadPicture } }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('v1');
    // Authentication is outside this transport-only fixture.
    app.use(
      (
        req: { user: { username: string } },
        _res: unknown,
        next: () => void,
      ) => {
        req.user = { username: 'test-operator' };
        next();
      },
    );
    await app.init();
  });

  beforeEach(() => uploadPicture.mockClear());
  afterAll(async () => app.close());

  it('accepts a single image without a multipart parts error', async () => {
    await request(app.getHttpServer())
      .post(path)
      .attach('file', png, 'photo.png')
      .expect(201);
    expect(uploadPicture).toHaveBeenCalledWith(
      'test-uid',
      expect.objectContaining({ fieldname: 'file', buffer: png }),
      'test-operator',
    );
  });

  it('rejects a second file before calling the service', async () => {
    await request(app.getHttpServer())
      .post(path)
      .attach('file', png, 'first.png')
      .attach('file', png, 'second.png')
      .expect(400);
    expect(uploadPicture).not.toHaveBeenCalled();
  });

  it('rejects extra text fields before calling the service', async () => {
    await request(app.getHttpServer())
      .post(path)
      .attach('file', png, 'photo.png')
      .field('extra', 'not-allowed')
      .expect(400);
    expect(uploadPicture).not.toHaveBeenCalled();
  });

  it('rejects an unexpected file field', async () => {
    await request(app.getHttpServer())
      .post(path)
      .attach('picture', png, 'photo.png')
      .expect(400);
    expect(uploadPicture).not.toHaveBeenCalled();
  });

  it('rejects a missing image', async () => {
    await request(app.getHttpServer()).post(path).expect(400);
    expect(uploadPicture).not.toHaveBeenCalled();
  });

  it('rejects images larger than 5 MB before calling the service', async () => {
    await request(app.getHttpServer())
      .post(path)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png')
      .expect(413);
    expect(uploadPicture).not.toHaveBeenCalled();
  });
});
