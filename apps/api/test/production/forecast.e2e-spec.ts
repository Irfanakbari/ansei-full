import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';

describe('Production Forecast E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let token: string;

  const mockUser = {
    sub: 'admin',
    username: 'admin',
    name: 'Admin User',
    email: 'admin@test.com',
    permissions: [
      'FORECAST_READ',
      'FORECAST_CREATE',
      'FORECAST_UPDATE',
      'FORECAST_DELETE',
    ],
    departments: ['Production'],
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(JwtStrategy)
      .useValue({
        validate: () => mockUser,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );

    app.use((req: any, _res: any, next: any) => {
      req.user = mockUser;
      next();
    });

    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    token = jwtService.sign(mockUser);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Cleanup
    await prisma.forecast.deleteMany({
      where: { PoId: { startsWith: 'TEST_' } },
    });
  });

  describe('/production/forecast (Forecast)', () => {
    it('POST /production/forecast - should create forecast', async () => {
      const res = await request(app.getHttpServer())
        .post('/production/forecast')
        .set('Authorization', `Bearer ${token}`)
        .send({
          poId: 'TEST_PO_001',
          date: new Date().toISOString(),
          supplierId: 'TEST-SUP-001',
          notes: 'Test forecast',
        })
        .expect(201);

      expect(res.body.PoId).toBe('TEST_PO_001');
    });

    it('GET /production/forecast - should list all forecasts', async () => {
      await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_LIST_001',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/production/forecast')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /production/forecast/operator - should list forecasts for operator', async () => {
      const res = await request(app.getHttpServer())
        .get('/production/forecast/operator')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /production/forecast/:id - should get forecast by id', async () => {
      const created = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_GET_001',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/production/forecast/${created.PoId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.PoId).toBe('TEST_PO_GET_001');
    });

    it('PATCH /production/forecast/:id - should update forecast', async () => {
      const created = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_UPDATE_001',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/production/forecast/${created.PoId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Updated notes' })
        .expect(200);

      expect(res.body.Notes).toBe('Updated notes');
    });

    it('DELETE /production/forecast/:id - should delete forecast', async () => {
      const created = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_DELETE_001',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      await request(app.getHttpServer())
        .delete(`/production/forecast/${created.PoId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
