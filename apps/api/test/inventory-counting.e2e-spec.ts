import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { ItemCategory, OpnameStatus } from '../src/generated/prisma/enums';

describe('Inventory Counting E2E', () => {
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
      'INVENTORY_COUNTING_READ',
      'INVENTORY_COUNTING_CREATE',
      'INVENTORY_COUNTING_UPDATE',
      'INVENTORY_COUNTING_DELETE',
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
    await prisma.stockOpnameDetail.deleteMany({
      where: { OpnameId: { startsWith: 'TEST-' } },
    });
    await prisma.stockOpname.deleteMany({
      where: { Id: { startsWith: 'TEST-' } },
    });
  });

  describe('/inventory-counting (Inventory Counting)', () => {
    it('POST /inventory-counting - should create inventory counting', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory-counting')
        .set('Authorization', `Bearer ${token}`)
        .send({
          recordNumber: 'TEST-INV-001',
          category: ItemCategory.MATERIAL,
          notes: 'Test inventory counting',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.RecordNumber).toBe('TEST-INV-001');
    });

    it('GET /inventory-counting - should list all inventory counting', async () => {
      await prisma.stockOpname.create({
        data: {
          Id: 'TEST-INV-LIST-001',
          RecordNumber: 'TEST-INV-LIST-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/inventory-counting')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(
        Array.isArray(res.body.data) || typeof res.body.data === 'object',
      ).toBe(true);
    });

    it('GET /inventory-counting/:id - should get inventory counting by id', async () => {
      const created = await prisma.stockOpname.create({
        data: {
          Id: 'TEST-INV-GET-001',
          RecordNumber: 'TEST-INV-GET-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/inventory-counting/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Id).toBe('TEST-INV-GET-001');
    });

    it('PATCH /inventory-counting/:id - should update inventory counting', async () => {
      const created = await prisma.stockOpname.create({
        data: {
          Id: 'TEST-INV-UPD-001',
          RecordNumber: 'TEST-INV-UPD-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/inventory-counting/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Updated notes' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('DELETE /inventory-counting/:id - should delete inventory counting', async () => {
      const created = await prisma.stockOpname.create({
        data: {
          Id: 'TEST-INV-DEL-001',
          RecordNumber: 'TEST-INV-DEL-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      await request(app.getHttpServer())
        .delete(`/inventory-counting/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('POST /inventory-counting/:id/start - should start inventory counting', async () => {
      const created = await prisma.stockOpname.create({
        data: {
          Id: 'TEST-INV-START-001',
          RecordNumber: 'TEST-INV-START-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/inventory-counting/${created.Id}/start`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('POST /inventory-counting/generate-cutoff - should generate cut-off items', async () => {
      const opname = await prisma.stockOpname.create({
        data: {
          Id: 'TEST-INV-CUTOFF-001',
          RecordNumber: 'TEST-INV-CUTOFF-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/inventory-counting/generate-cutoff')
        .set('Authorization', `Bearer ${token}`)
        .send({
          inventoryCountingId: opname.Id,
          itemCategory: ItemCategory.MATERIAL,
          location: 'WAREHOUSE',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('POST /inventory-counting/close - should close inventory counting', async () => {
      const opname = await prisma.stockOpname.create({
        data: {
          Id: 'TEST-INV-CLOSE-001',
          RecordNumber: 'TEST-INV-CLOSE-001',
          Category: ItemCategory.MATERIAL,
          Status: OpnameStatus.IN_PROGRESS,
          StartedAt: new Date(),
          CreatedBy: 'admin',
        },
      });

      // Create detail with actual qty
      await prisma.stockOpnameDetail.create({
        data: {
          OpnameId: opname.Id,
          MaterialId: 'MAT-TEST',
          Location: 'WAREHOUSE',
          SystemQty: 100,
          ActualQty: 95,
          DiffQty: -5,
        },
      });

      const res = await request(app.getHttpServer())
        .post('/inventory-counting/close')
        .set('Authorization', `Bearer ${token}`)
        .send({ id: opname.Id })
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
