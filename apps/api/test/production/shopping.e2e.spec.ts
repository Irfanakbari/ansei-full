import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';

describe('Production Shopping E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let token: string;

  const mockUser = {
    sub: 'admin',
    username: 'admin',
    name: 'Admin User',
    email: 'admin@test.com',
    permissions: ['SHOPPING_READ', 'SHOPPING_CREATE', 'SHOPPING_DELETE'],
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
    // Cleanup test shopping records
    await prisma.shopping.deleteMany({
      where: { Id: { startsWith: 'TEST_' } },
    });
  });

  describe('/production/shopping (Shopping)', () => {
    it('GET /production/shopping - should list all shopping', async () => {
      // Create test data
      const material = await prisma.material.findFirst();
      const forecast = await prisma.forecast.findFirst();

      if (material && forecast) {
        await prisma.shopping.create({
          data: {
            Id: 'TEST_SHOPPING_001',
            ForecastId: forecast.PoId,
            MaterialId: material.PartNumber,
            QtyPick: 5,
            Type: 'REGULER' as const,
            CreatedBy: 'admin',
          },
        });
      }

      const res = await request(app.getHttpServer())
        .get('/production/shopping')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /production/shopping/:id - should get shopping by id', async () => {
      const material = await prisma.material.findFirst();
      const forecast = await prisma.forecast.findFirst();

      if (material && forecast) {
        await prisma.shopping.create({
          data: {
            Id: 'TEST_SHOPPING_002',
            ForecastId: forecast.PoId,
            MaterialId: material.PartNumber,
            QtyPick: 10,
            Type: 'REGULER' as const,
            CreatedBy: 'admin',
          },
        });

        const res = await request(app.getHttpServer())
          .get('/production/shopping/TEST_SHOPPING_002')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }
    });

    it('GET /production/shopping/forecast/:forecastId - should get shopping by forecast', async () => {
      const material = await prisma.material.findFirst();
      const forecast = await prisma.forecast.findFirst();

      if (material && forecast) {
        await prisma.shopping.create({
          data: {
            Id: 'TEST_SHOPPING_003',
            ForecastId: forecast.PoId,
            MaterialId: material.PartNumber,
            QtyPick: 3,
            Type: 'REGULER' as const,
            CreatedBy: 'admin',
          },
        });

        const res = await request(app.getHttpServer())
          .get(`/production/shopping/forecast/${forecast.PoId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('GET /production/shopping/material/:materialId - should get shopping by material', async () => {
      const material = await prisma.material.findFirst();
      const forecast = await prisma.forecast.findFirst();

      if (material && forecast) {
        const res = await request(app.getHttpServer())
          .get(`/production/shopping/material/${material.PartNumber}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
      }
    });

    it('POST /production/shopping - should create shopping with PRODUCTION_USAGE ledger', async () => {
      const material = await prisma.material.findFirst();
      const forecast = await prisma.forecast.findFirst();

      if (material && forecast) {
        // Get initial stock
        const initialMaterial = await prisma.material.findUnique({
          where: { PartNumber: material.PartNumber },
          select: { QtyRack: true },
        });
        const initialQty = initialMaterial?.QtyRack || 0;

        const res = await request(app.getHttpServer())
          .post('/production/shopping')
          .set('Authorization', `Bearer ${token}`)
          .send({
            id: 'TEST_SHOPPING_CREATE_001',
            forecastId: forecast.PoId,
            materialId: material.PartNumber,
            qtyPick: 5,
            type: 'REGULER',
            description: 'Test shopping creation',
          })
          .expect(201);

        expect(res.body.Id).toBe('TEST_SHOPPING_CREATE_001');
        expect(res.body.QtyPick).toBe(5);

        // Verify inventory ledger was created with PRODUCTION_USAGE
        const ledger = await prisma.inventoryLedger.findFirst({
          where: {
            ReferenceDoc: 'TEST_SHOPPING_CREATE_001',
          },
        });

        expect(ledger).toBeDefined();
        expect(ledger?.TransactionType).toBe('PRODUCTION_USAGE');
        expect(ledger?.QtyOut).toBe(5);

        // Verify material stock was reduced
        const updatedMaterial = await prisma.material.findUnique({
          where: { PartNumber: material.PartNumber },
          select: { QtyRack: true },
        });

        expect(updatedMaterial?.QtyRack).toBe(initialQty - 5);
      }
    });

    it('POST /production/shopping - should fail with insufficient stock', async () => {
      const material = await prisma.material.findFirst();
      const forecast = await prisma.forecast.findFirst();

      if (material && forecast) {
        // Get current stock
        const currentMaterial = await prisma.material.findUnique({
          where: { PartNumber: material.PartNumber },
          select: { QtyRack: true },
        });
        const currentQty = currentMaterial?.QtyRack || 0;

        // Try to pick more than available
        await request(app.getHttpServer())
          .post('/production/shopping')
          .set('Authorization', `Bearer ${token}`)
          .send({
            id: 'TEST_SHOPPING_CREATE_002',
            forecastId: forecast.PoId,
            materialId: material.PartNumber,
            qtyPick: currentQty + 10000, // More than available
            type: 'REGULER',
          })
          .expect(400);
      }
    });

    it('DELETE /production/shopping/:id - should delete shopping with qtyPick=0', async () => {
      const material = await prisma.material.findFirst();
      const forecast = await prisma.forecast.findFirst();

      if (material && forecast) {
        await prisma.shopping.create({
          data: {
            Id: 'TEST_SHOPPING_DELETE_001',
            ForecastId: forecast.PoId,
            MaterialId: material.PartNumber,
            QtyPick: 0, // Must be 0 to delete
            Type: 'REGULER' as const,
            CreatedBy: 'admin',
          },
        });

        const res = await request(app.getHttpServer())
          .delete('/production/shopping/TEST_SHOPPING_DELETE_001')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(res.body.deleted).toBe(true);
      }
    });

    it('DELETE /production/shopping/:id - should fail when qtyPick > 0', async () => {
      const material = await prisma.material.findFirst();
      const forecast = await prisma.forecast.findFirst();

      if (material && forecast) {
        await prisma.shopping.create({
          data: {
            Id: 'TEST_SHOPPING_DELETE_002',
            ForecastId: forecast.PoId,
            MaterialId: material.PartNumber,
            QtyPick: 5, // Not 0, should fail
            Type: 'REGULER' as const,
            CreatedBy: 'admin',
          },
        });

        await request(app.getHttpServer())
          .delete('/production/shopping/TEST_SHOPPING_DELETE_002')
          .set('Authorization', `Bearer ${token}`)
          .expect(400);
      }
    });
  });
});
