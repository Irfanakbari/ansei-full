import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';

describe('Warehouse Transfer E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let token: string;

  const mockUser = {
    sub: 'admin',
    username: 'admin',
    name: 'Admin User',
    email: 'admin@test.com',
    permissions: ['TRANSFER_CREATE', 'TRANSFER_READ'],
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
    await prisma.inventoryLedger.deleteMany({
      where: { Notes: { startsWith: 'TEST_' } },
    });
  });

  describe('/warehouse/material (Transfer)', () => {
    it('POST /warehouse/material/:partNumber/transfer-to-rack - should transfer to rack', async () => {
      // Create material with stock
      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-TRANS-001',
          PartName: 'Transfer Test Material',
          QtyWarehouse: 100,
          QtyRack: 0,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/warehouse/material/${material.PartNumber}/transfer-to-rack`)
        .set('Authorization', `Bearer ${token}`)
        .send({ qty: 50 })
        .expect(201);

      expect(res.body.success).toBe(true);

      // Verify stock was transferred
      const updatedMaterial = await prisma.material.findUnique({
        where: { PartNumber: material.PartNumber },
      });

      expect(updatedMaterial?.QtyWarehouse).toBe(50);
      expect(updatedMaterial?.QtyRack).toBe(50);
    });

    it('POST /warehouse/material/:partNumber/transfer-to-rack - should fail with insufficient stock', async () => {
      // Create material with low stock
      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-TRANS-002',
          PartName: 'Transfer Test Material 2',
          QtyWarehouse: 10,
          QtyRack: 0,
          CreatedBy: 'admin',
        },
      });

      await request(app.getHttpServer())
        .post(`/warehouse/material/${material.PartNumber}/transfer-to-rack`)
        .set('Authorization', `Bearer ${token}`)
        .send({ qty: 100 }) // More than available
        .expect(400);
    });
  });
});
