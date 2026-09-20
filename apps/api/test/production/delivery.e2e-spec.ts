import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';

describe('Production Delivery E2E', () => {
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
      'DELIVERY_READ',
      'DELIVERY_CREATE',
      'POKAYOKE_READ',
      'POKAYOKE_CREATE',
      'PRODUCTION_REPORT_READ',
      'PRODUCTION_REPORT_CREATE',
      'PRODUCTION_REPORT_UPDATE',
      'PRODUCTION_REPORT_DELETE',
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
    // Cleanup - use CreatedBy filter since Id is Int
    await prisma.deliveryHistory.deleteMany({ where: { CreatedBy: 'admin' } });
    await prisma.pokayokeScanHistory.deleteMany({
      where: { CreatedBy: 'admin' },
    });
    await prisma.productionReport.deleteMany({ where: { CreatedBy: 'admin' } });
  });

  describe('/production/delivery (Delivery)', () => {
    it('POST /production/delivery - should create delivery with POKAYOKE validation', async () => {
      // Create forecast first
      const forecast = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_DELIVERY_001',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      // Create finish good
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-DEL-001',
          PartName: 'Delivery Test FG',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      // Create production report first
      const prodReport = await prisma.productionReport.create({
        data: {
          Id: 'TEST_PR_001',
          ProductionDate: new Date(),
          Line: 'LINE-A',
          Shift: 'DAY',
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          ActualQty: 95,
          NgQty: 5,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/production/delivery')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: 'TEST_DELIVERY_001',
          productionReportId: prodReport.Id,
          finishGoodId: fg.PartNumber,
          deliveryDate: new Date().toISOString(),
          deliveryQty: 90,
          boxQty: 10,
          destination: 'Customer A',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.Id).toBe('TEST_DELIVERY_001');
    });

    it('GET /production/delivery - should list all deliveries', async () => {
      const res = await request(app.getHttpServer())
        .get('/production/delivery')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(
        Array.isArray(res.body.data) || typeof res.body.data === 'object',
      ).toBe(true);
    });
  });

  describe('/production/pokayoke (Pokayoke)', () => {
    it('POST /production/pokayoke/scan - should scan and validate', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PK-001',
          PartName: 'Pokayoke Test FG',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/production/pokayoke/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({
          labelNumber: 'TEST-LABEL-001',
          finishGoodId: fg.PartNumber,
          qty: 10,
          productionDate: new Date().toISOString(),
          line: 'LINE-A',
          shift: 'DAY',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
    });

    it('GET /production/pokayoke - should list all pokayoke scans', async () => {
      const res = await request(app.getHttpServer())
        .get('/production/pokayoke')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(
        Array.isArray(res.body.data) || typeof res.body.data === 'object',
      ).toBe(true);
    });
  });

  describe('/production/production-report (Production Report)', () => {
    it('POST /production/production-report - should create production report (public)', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-001',
          PartName: 'Production Report Test FG',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/production/production-report')
        .send({
          productionDate: new Date().toISOString(),
          line: 'LINE-A',
          shift: 'DAY',
          finishGoodId: fg.PartNumber,
          planQty: 100,
          actualQty: 95,
          ngQty: 5,
          ngReasons: 'Minor defect',
        })
        .expect(201);

      expect(res.body.Id).toBeDefined();
    });

    it('GET /production/production-report - should list all production reports', async () => {
      const res = await request(app.getHttpServer())
        .get('/production/production-report')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(
        Array.isArray(res.body.data) || typeof res.body.data === 'object',
      ).toBe(true);
    });

    it('GET /production/production-report/:id - should get production report by id', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-002',
          PartName: 'Production Report Test FG 2',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const created = await prisma.productionReport.create({
        data: {
          ProductionDate: new Date(),
          Line: 'LINE-A',
          Shift: 'DAY',
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          ActualQty: 95,
          NgQty: 5,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/production/production-report/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Id).toBe(created.Id);
    });

    it('PATCH /production/production-report/:id - should update production report', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-003',
          PartName: 'Production Report Test FG 3',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const created = await prisma.productionReport.create({
        data: {
          ProductionDate: new Date(),
          Line: 'LINE-A',
          Shift: 'DAY',
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          ActualQty: 95,
          NgQty: 5,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/production/production-report/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ actualQty: 98 })
        .expect(200);

      expect(res.body.ActualQty).toBe(98);
    });

    it('POST /production/production-report/:id/validate - should validate report', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-004',
          PartName: 'Production Report Test FG 4',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const created = await prisma.productionReport.create({
        data: {
          ProductionDate: new Date(),
          Line: 'LINE-A',
          Shift: 'DAY',
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          ActualQty: 95,
          NgQty: 5,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/production/production-report/${created.Id}/validate`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.ValidatedAt).toBeDefined();
    });

    it('POST /production/production-report/:id/unvalidate - should unvalidate report', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-005',
          PartName: 'Production Report Test FG 5',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const created = await prisma.productionReport.create({
        data: {
          ProductionDate: new Date(),
          Line: 'LINE-A',
          Shift: 'DAY',
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          ActualQty: 95,
          NgQty: 5,
          ValidatedAt: new Date(),
          ValidatedBy: 'admin',
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/production/production-report/${created.Id}/unvalidate`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.ValidatedAt).toBeNull();
    });

    it('DELETE /production/production-report/:id - should delete production report', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-006',
          PartName: 'Production Report Test FG 6',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const created = await prisma.productionReport.create({
        data: {
          ProductionDate: new Date(),
          Line: 'LINE-A',
          Shift: 'DAY',
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          ActualQty: 95,
          NgQty: 5,
          CreatedBy: 'admin',
        },
      });

      await request(app.getHttpServer())
        .delete(`/production/production-report/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
