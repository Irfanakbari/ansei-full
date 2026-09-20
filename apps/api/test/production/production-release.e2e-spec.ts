import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';

describe('Production Release E2E', () => {
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
      'PRODUCTION_RELEASE_READ',
      'PRODUCTION_RELEASE_CREATE',
      'PRODUCTION_RELEASE_UPDATE',
      'PRODUCTION_RELEASE_DELETE',
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
    await prisma.productionRelease.deleteMany({
      where: { Id: { startsWith: 'TEST_' } },
    });
  });

  describe('/production/production-release (Production Release)', () => {
    it('POST /production/production-release - should create production release', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-REL-001',
          PartName: 'Production Release Test FG',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/production/production-release')
        .set('Authorization', `Bearer ${token}`)
        .send({
          releaseNumber: 'TEST-REL-001',
          productionDate: new Date().toISOString(),
          finishGoodId: fg.PartNumber,
          planQty: 100,
          line: 'LINE-A',
          shift: 'DAY',
        })
        .expect(201);

      expect(res.body.ReleaseNumber).toBe('TEST-REL-001');
    });

    it('GET /production/production-release - should list all production releases', async () => {
      const res = await request(app.getHttpServer())
        .get('/production/production-release')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /production/production-release/release-number/:releaseNumber - should get by release number', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-REL-002',
          PartName: 'Production Release Test FG 2',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      await prisma.productionRelease.create({
        data: {
          ReleaseNumber: 'TEST-REL-BY-NUMBER',
          ProductionDate: new Date(),
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          Line: 'LINE-A',
          Shift: 'DAY',
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/production/production-release/release-number/TEST-REL-BY-NUMBER')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.ReleaseNumber).toBe('TEST-REL-BY-NUMBER');
    });

    it('GET /production/production-release/:id - should get production release by id', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-REL-003',
          PartName: 'Production Release Test FG 3',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const created = await prisma.productionRelease.create({
        data: {
          ReleaseNumber: 'TEST-REL-GET-001',
          ProductionDate: new Date(),
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          Line: 'LINE-A',
          Shift: 'DAY',
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/production/production-release/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Id).toBe(created.Id);
    });

    it('PATCH /production/production-release/:id - should update production release', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-REL-004',
          PartName: 'Production Release Test FG 4',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const created = await prisma.productionRelease.create({
        data: {
          ReleaseNumber: 'TEST-REL-UPD-001',
          ProductionDate: new Date(),
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          Line: 'LINE-A',
          Shift: 'DAY',
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/production/production-release/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ planQty: 150 })
        .expect(200);

      expect(res.body.PlanQty).toBe(150);
    });

    it('DELETE /production/production-release/:id - should delete production release', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PR-REL-005',
          PartName: 'Production Release Test FG 5',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const created = await prisma.productionRelease.create({
        data: {
          ReleaseNumber: 'TEST-REL-DEL-001',
          ProductionDate: new Date(),
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          Line: 'LINE-A',
          Shift: 'DAY',
          CreatedBy: 'admin',
        },
      });

      await request(app.getHttpServer())
        .delete(`/production/production-release/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
