import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';

describe('Production Pre-Delivery E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let token: string;

  const mockUser = {
    sub: 'admin',
    username: 'admin',
    name: 'Admin User',
    email: 'admin@test.com',
    permissions: ['PRE_DELIVERY_READ'],
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
    await prisma.labelData.deleteMany({
      where: { LabelNumber: { startsWith: 'TEST-' } },
    });
  });

  describe('/production/pre-delivery (Pre-Delivery)', () => {
    it('GET /production/pre-delivery - should list all pre-delivery data', async () => {
      const res = await request(app.getHttpServer())
        .get('/production/pre-delivery')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(typeof res.body.data === 'object').toBe(true);
    });

    it('GET /production/pre-delivery/summary - should get summary', async () => {
      const res = await request(app.getHttpServer())
        .get('/production/pre-delivery/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body !== undefined).toBe(true);
    });

    it('GET /production/pre-delivery/:labeldata - should get pre-delivery by label number', async () => {
      // Create finish good first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-PRE-001',
          PartName: 'Pre-Delivery Test FG',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      // Create production release
      const release = await prisma.productionRelease.create({
        data: {
          ReleaseNumber: 'TEST-REL-PRE-001',
          ProductionDate: new Date(),
          FinishGoodId: fg.PartNumber,
          PlanQty: 100,
          Line: 'LINE-A',
          Shift: 'DAY',
          CreatedBy: 'admin',
        },
      });

      // Create label data
      const labelData = await prisma.labelData.create({
        data: {
          LabelNumber: 'TEST-LABEL-001',
          ProductionReleaseId: release.Id,
          FinishGoodId: fg.PartNumber,
          Qty: 10,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/production/pre-delivery/${labelData.LabelNumber}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.LabelNumber).toBe('TEST-LABEL-001');
    });
  });
});
