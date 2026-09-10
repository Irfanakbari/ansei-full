import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';

describe('Warehouse Incoming E2E', () => {
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
      'INCOMING_READ',
      'INCOMING_CREATE',
      'INCOMING_UPDATE',
      'INCOMING_DELETE',
    ],
    departments: ['Warehouse'],
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
    await prisma.incomingMaterial.deleteMany({
      where: { IncomingId: { startsWith: 'TEST_' } },
    });
    await prisma.incoming.deleteMany({
      where: { PoId: { startsWith: 'TEST_' } },
    });
  });

  describe('/warehouse/incoming (Incoming)', () => {
    it('POST /warehouse/incoming - should create incoming', async () => {
      // Create forecast first
      const forecast = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_INC_001',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      // Create material
      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-INC-001',
          PartName: 'Incoming Test Material',
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/warehouse/incoming')
        .set('Authorization', `Bearer ${token}`)
        .send({
          id: 'TEST_INC_001',
          forecastId: forecast.PoId,
          materialId: material.PartNumber,
          incomingDate: new Date().toISOString(),
          qty: 100,
          batchNumber: 'BATCH-001',
        })
        .expect(201);

      expect(res.body.Id).toBe('TEST_INC_001');
    });

    it('GET /warehouse/incoming - should list all incoming', async () => {
      const res = await request(app.getHttpServer())
        .get('/warehouse/incoming')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /warehouse/incoming/po/:poId - should get incoming by PO id', async () => {
      const forecast = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_INC_002',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-INC-002',
          PartName: 'Incoming Test Material 2',
          CreatedBy: 'admin',
        },
      });

      await prisma.incoming.create({
        data: {
          Id: 'TEST_INC_002',
          ForecastId: forecast.PoId,
          MaterialId: material.PartNumber,
          IncomingDate: new Date(),
          Qty: 50,
          BatchNumber: 'BATCH-002',
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/warehouse/incoming/po/${forecast.PoId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /warehouse/incoming/:id - should get incoming by id', async () => {
      const forecast = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_INC_003',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-INC-003',
          PartName: 'Incoming Test Material 3',
          CreatedBy: 'admin',
        },
      });

      const created = await prisma.incoming.create({
        data: {
          Id: 'TEST_INC_003',
          ForecastId: forecast.PoId,
          MaterialId: material.PartNumber,
          IncomingDate: new Date(),
          Qty: 75,
          BatchNumber: 'BATCH-003',
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/warehouse/incoming/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Id).toBe('TEST_INC_003');
    });

    it('PATCH /warehouse/incoming/:id - should update incoming', async () => {
      const forecast = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_INC_004',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-INC-004',
          PartName: 'Incoming Test Material 4',
          CreatedBy: 'admin',
        },
      });

      const created = await prisma.incoming.create({
        data: {
          Id: 'TEST_INC_004',
          ForecastId: forecast.PoId,
          MaterialId: material.PartNumber,
          IncomingDate: new Date(),
          Qty: 100,
          BatchNumber: 'BATCH-004',
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/warehouse/incoming/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ qty: 150 })
        .expect(200);

      expect(res.body.Qty).toBe(150);
    });

    it('POST /warehouse/incoming/:id/receive - should receive incoming', async () => {
      const forecast = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_INC_005',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-INC-005',
          PartName: 'Incoming Test Material 5',
          CreatedBy: 'admin',
        },
      });

      const created = await prisma.incoming.create({
        data: {
          Id: 'TEST_INC_005',
          ForecastId: forecast.PoId,
          MaterialId: material.PartNumber,
          IncomingDate: new Date(),
          Qty: 100,
          BatchNumber: 'BATCH-005',
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/warehouse/incoming/${created.Id}/receive`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('DELETE /warehouse/incoming/:id - should delete incoming', async () => {
      const forecast = await prisma.forecast.create({
        data: {
          PoId: 'TEST_PO_INC_006',
          Date: new Date(),
          CreatedBy: 'admin',
        },
      });

      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-INC-006',
          PartName: 'Incoming Test Material 6',
          CreatedBy: 'admin',
        },
      });

      const created = await prisma.incoming.create({
        data: {
          Id: 'TEST_INC_006',
          ForecastId: forecast.PoId,
          MaterialId: material.PartNumber,
          IncomingDate: new Date(),
          Qty: 100,
          BatchNumber: 'BATCH-006',
          CreatedBy: 'admin',
        },
      });

      await request(app.getHttpServer())
        .delete(`/warehouse/incoming/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
