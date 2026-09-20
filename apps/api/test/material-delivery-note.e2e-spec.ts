import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { DeliveryNoteStatus } from '../src/generated/prisma/enums';

describe('Material Delivery Note E2E', () => {
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
      'TRANSFER_MATERIAL_READ',
      'TRANSFER_MATERIAL_CREATE',
      'TRANSFER_MATERIAL_UPDATE',
      'TRANSFER_MATERIAL_DELETE',
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
    await prisma.materialDeliveryNoteDetail.deleteMany({
      where: { DeliveryNoteId: { startsWith: 'TEST_' } },
    });
    await prisma.materialDeliveryNote.deleteMany({
      where: { DeliveryNoteNum: { startsWith: 'TEST_' } },
    });
  });

  describe('/transfer-material (Material Delivery Note)', () => {
    it('POST /transfer-material - should create delivery note', async () => {
      const res = await request(app.getHttpServer())
        .post('/transfer-material')
        .set('Authorization', `Bearer ${token}`)
        .send({
          destination: 'Customer A',
          notes: 'Test delivery note',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.Destination).toBe('Customer A');
    });

    it('GET /transfer-material - should list all delivery notes', async () => {
      await prisma.materialDeliveryNote.create({
        data: {
          DeliveryNoteNum: 'TEST-DN-LIST-001',
          Destination: 'Customer B',
          Status: DeliveryNoteStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/transfer-material')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(typeof res.body.data === 'object').toBe(true);
    });

    it('GET /transfer-material/:id - should get delivery note by id', async () => {
      const created = await prisma.materialDeliveryNote.create({
        data: {
          DeliveryNoteNum: 'TEST-DN-GET-001',
          Destination: 'Customer C',
          Status: DeliveryNoteStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/transfer-material/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Id).toBe(created.Id);
    });

    it('PATCH /transfer-material/:id - should update delivery note', async () => {
      const created = await prisma.materialDeliveryNote.create({
        data: {
          DeliveryNoteNum: 'TEST-DN-UPD-001',
          Destination: 'Customer D',
          Status: DeliveryNoteStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/transfer-material/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ destination: 'Customer E' })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('DELETE /transfer-material/:id - should delete delivery note', async () => {
      const created = await prisma.materialDeliveryNote.create({
        data: {
          DeliveryNoteNum: 'TEST-DN-DEL-001',
          Destination: 'Customer F',
          Status: DeliveryNoteStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      await request(app.getHttpServer())
        .delete(`/transfer-material/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('PATCH /transfer-material/:id/pick - should pick material', async () => {
      const created = await prisma.materialDeliveryNote.create({
        data: {
          DeliveryNoteNum: 'TEST-DN-PICK-001',
          Destination: 'Customer G',
          Status: DeliveryNoteStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      // Create material first
      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-PICK-001',
          PartName: 'Pick Test Material',
          QtyRack: 100,
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/transfer-material/${created.Id}/pick`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          materialId: material.PartNumber,
          qty: 10,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('POST /transfer-material/:id/ship - should ship delivery note', async () => {
      const created = await prisma.materialDeliveryNote.create({
        data: {
          DeliveryNoteNum: 'TEST-DN-SHIP-001',
          Destination: 'Customer H',
          Status: DeliveryNoteStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/transfer-material/${created.Id}/ship`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('POST /transfer-material/:id/receive - should receive delivery note', async () => {
      const created = await prisma.materialDeliveryNote.create({
        data: {
          DeliveryNoteNum: 'TEST-DN-RECV-001',
          Destination: 'Customer I',
          Status: DeliveryNoteStatus.SHIPPED,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/transfer-material/${created.Id}/receive`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('POST /transfer-material/:id/cancel - should cancel delivery note', async () => {
      const created = await prisma.materialDeliveryNote.create({
        data: {
          DeliveryNoteNum: 'TEST-DN-CANCEL-001',
          Destination: 'Customer J',
          Status: DeliveryNoteStatus.DRAFT,
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/transfer-material/${created.Id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });
});
