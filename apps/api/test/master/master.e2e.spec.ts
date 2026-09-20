import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';

describe('Master Modules E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let token: string;

  const mockUser = {
    sub: 'test-user-id',
    username: 'admin',
    email: 'admin@test.com',
    permissions: [
      'MASTER_READ',
      'MASTER_CREATE',
      'MASTER_UPDATE',
      'MASTER_DELETE',
      'SATUAN_READ',
      'SATUAN_CREATE',
      'SATUAN_UPDATE',
      'SATUAN_DELETE',
      'SUPPLIER_READ',
      'SUPPLIER_CREATE',
      'SUPPLIER_UPDATE',
      'SUPPLIER_DELETE',
      'MATERIAL_READ',
      'MATERIAL_CREATE',
      'MATERIAL_UPDATE',
      'MATERIAL_DELETE',
      'FINISHGOOD_READ',
      'FINISHGOOD_CREATE',
      'FINISHGOOD_UPDATE',
      'FINISHGOOD_DELETE',
      'BOXQTY_READ',
      'BOXQTY_CREATE',
      'BOXQTY_UPDATE',
      'BOXQTY_DELETE',
      'BILLMATERIALS_READ',
      'BILLMATERIALS_CREATE',
      'BILLMATERIALS_UPDATE',
      'BILLMATERIALS_DELETE',
      'MANPOWER_READ',
      'MANPOWER_CREATE',
      'MANPOWER_UPDATE',
      'MANPOWER_DELETE',
      'FORECAST_READ',
      'FORECAST_CREATE',
      'FORECAST_UPDATE',
      'FORECAST_DELETE',
      'PRODUCTIONRELEASE_READ',
      'PRODUCTIONRELEASE_CREATE',
      'PRODUCTIONRELEASE_UPDATE',
      'PRODUCTIONRELEASE_DELETE',
      'INCOMING_READ',
      'INCOMING_CREATE',
      'INCOMING_UPDATE',
      'INCOMING_DELETE',
      'SHOPPING_READ',
      'SHOPPING_CREATE',
      'SHOPPING_UPDATE',
      'SHOPPING_DELETE',
      'TRANSFER_CREATE',
      'DASHBOARDSETTING_READ',
      'DASHBOARDSETTING_UPDATE',
      'EMAILNOTIFICATION_READ',
      'EMAILNOTIFICATION_CREATE',
      'EMAILNOTIFICATION_UPDATE',
      'EMAILNOTIFICATION_DELETE',
    ],
    departments: ['Production', 'Warehouse'],
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

    // Mock the request with user for @CurrentUser() decorator
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
    // Cleanup in reverse dependency order
    await prisma.billOfMaterials.deleteMany({ where: {} });
    await prisma.boxQTY.deleteMany({ where: {} });
    await prisma.materialDeliveryNoteDetail.deleteMany({ where: {} });
    await prisma.materialDeliveryNote.deleteMany({ where: {} });
    await prisma.shopping.deleteMany({ where: {} });
    await prisma.materialNG.deleteMany({ where: {} });
    await prisma.incomingMaterial.deleteMany({ where: {} });
    await prisma.incoming.deleteMany({ where: {} });
    await prisma.stockOpnameDetail.deleteMany({ where: {} });
    await prisma.stockOpname.deleteMany({ where: {} });
    await prisma.satuan.deleteMany({ where: {} });
    await prisma.supplier.deleteMany({ where: {} });
    await prisma.finishGood.deleteMany({ where: {} });
    await prisma.material.deleteMany({ where: {} });
    await prisma.manPower.deleteMany({ where: {} });
  });

  // ============================================
  // SATUAN TESTS
  // ============================================
  describe('/master/satuan (Satuan)', () => {
    it('POST /master/satuan - should create satuan', async () => {
      const res = await request(app.getHttpServer())
        .post('/master/satuan')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'PCS' })
        .expect(201);

      expect(res.body).toMatchObject({ Name: 'PCS' });
      expect(res.body.Id).toBeDefined();
    });

    it('GET /master/satuan - should list all satuans', async () => {
      await prisma.satuan.create({
        data: { Name: 'BOX', CreatedBy: 'TEST', UpdatedBy: 'TEST' },
      });

      const res = await request(app.getHttpServer())
        .get('/master/satuan')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /master/satuan/:id - should get satuan by id', async () => {
      const created = await prisma.satuan.create({
        data: { Name: 'KG', CreatedBy: 'TEST', UpdatedBy: 'TEST' },
      });

      const res = await request(app.getHttpServer())
        .get(`/master/satuan/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Name).toBe('KG');
    });

    it('PATCH /master/satuan/:id - should update satuan', async () => {
      const created = await prisma.satuan.create({
        data: { Name: 'ORIGINAL', CreatedBy: 'TEST', UpdatedBy: 'TEST' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/master/satuan/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'UPDATED' })
        .expect(200);

      expect(res.body.Name).toBe('UPDATED');
    });

    it('DELETE /master/satuan/:id - should delete satuan', async () => {
      const created = await prisma.satuan.create({
        data: { Name: 'DELETE_ME', CreatedBy: 'TEST', UpdatedBy: 'TEST' },
      });

      await request(app.getHttpServer())
        .delete(`/master/satuan/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ============================================
  // SUPPLIER TESTS
  // ============================================
  describe('/master/supplier (Supplier)', () => {
    it('POST /master/supplier - should create supplier', async () => {
      const res = await request(app.getHttpServer())
        .post('/master/supplier')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'PT Test Supplier' })
        .expect(201);

      expect(res.body).toMatchObject({ Name: 'PT Test Supplier' });
    });

    it('GET /master/supplier - should list all suppliers', async () => {
      await prisma.supplier.create({
        data: { Name: 'Supplier A', CreatedBy: 'TEST', UpdatedBy: 'TEST' },
      });

      const res = await request(app.getHttpServer())
        .get('/master/supplier')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /master/supplier/:id - should get supplier by id', async () => {
      const created = await prisma.supplier.create({
        data: { Name: 'Supplier B', CreatedBy: 'TEST', UpdatedBy: 'TEST' },
      });

      const res = await request(app.getHttpServer())
        .get(`/master/supplier/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Name).toBe('Supplier B');
    });

    it('PATCH /master/supplier/:id - should update supplier', async () => {
      const created = await prisma.supplier.create({
        data: { Name: 'Old Name', CreatedBy: 'TEST', UpdatedBy: 'TEST' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/master/supplier/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.Name).toBe('New Name');
    });

    it('DELETE /master/supplier/:id - should delete supplier', async () => {
      const created = await prisma.supplier.create({
        data: { Name: 'To Delete', CreatedBy: 'TEST', UpdatedBy: 'TEST' },
      });

      await request(app.getHttpServer())
        .delete(`/master/supplier/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ============================================
  // MATERIAL TESTS
  // ============================================
  describe('/master/material (Material)', () => {
    it('POST /master/material - should create material', async () => {
      const res = await request(app.getHttpServer())
        .post('/master/material')
        .set('Authorization', `Bearer ${token}`)
        .send({
          partNumber: 'MAT-001',
          partName: 'Screw M5',
          supplier: 'PT Fastener',
          qtyRack: 100,
          qtyWarehouse: 50,
          createdBy: 'admin',
        })
        .expect(201);

      expect(res.body.PartNumber).toBe('MAT-001');
    });

    it('GET /master/material - should list all materials', async () => {
      await prisma.material.create({
        data: {
          PartNumber: 'MAT-002',
          PartName: 'Bolt M8',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/master/material')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /master/material/part-number/:partNumber - should get by part number', async () => {
      await prisma.material.create({
        data: {
          PartNumber: 'MAT-003',
          PartName: 'Nut M5',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/master/material/part-number/MAT-003')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.PartNumber).toBe('MAT-003');
    });

    it('PATCH /master/material/:id - should update material', async () => {
      const created = await prisma.material.create({
        data: {
          PartNumber: 'MAT-004',
          PartName: 'Washer Original',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/master/material/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ partName: 'Washer Updated' })
        .expect(200);

      expect(res.body.PartName).toBe('Washer Updated');
    });

    it('DELETE /master/material/:id - should delete material', async () => {
      const created = await prisma.material.create({
        data: {
          PartNumber: 'MAT-DEL',
          PartName: 'To Delete',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      await request(app.getHttpServer())
        .delete(`/master/material/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ============================================
  // FINISH GOOD TESTS
  // ============================================
  describe('/master/finish-good (FinishGood)', () => {
    it('POST /master/finish-good - should create finish good', async () => {
      const res = await request(app.getHttpServer())
        .post('/master/finish-good')
        .set('Authorization', `Bearer ${token}`)
        .send({
          partNumber: 'FG-001',
          partName: 'Product A',
          price: 15000,
          qty: 0,
          createdBy: 'admin',
        })
        .expect(201);

      expect(res.body.PartNumber).toBe('FG-001');
    });

    it('GET /master/finish-good - should list all finish goods', async () => {
      await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-002',
          PartName: 'Product B',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/master/finish-good')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /master/finish-good/part-number/:partNumber - should get by part number', async () => {
      await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-003',
          PartName: 'Product C',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/master/finish-good/part-number/FG-003')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.PartNumber).toBe('FG-003');
    });

    it('PATCH /master/finish-good/:id - should update finish good', async () => {
      const created = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-004',
          PartName: 'Original',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/master/finish-good/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ partName: 'Updated Name' })
        .expect(200);

      expect(res.body.PartName).toBe('Updated Name');
    });

    it('DELETE /master/finish-good/:id - should delete finish good', async () => {
      const created = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-DEL',
          PartName: 'To Delete',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      await request(app.getHttpServer())
        .delete(`/master/finish-good/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ============================================
  // BILL OF MATERIALS TESTS
  // ============================================
  describe('/master/bill-of-materials (BillOfMaterials)', () => {
    it('POST /master/bill-of-materials - should create bill of materials', async () => {
      // Create finish good and material first
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-BOM-001',
          PartName: 'BOM Test FG',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });
      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-BOM-001',
          PartName: 'BOM Test Material',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/master/bill-of-materials')
        .set('Authorization', `Bearer ${token}`)
        .send({
          materialId: material.Id,
          finishGoodId: fg.Id,
          qty: 5,
        })
        .expect(201);

      expect(res.body.MaterialId).toBe(material.Id);
      expect(res.body.FinishGoodId).toBe(fg.Id);
      expect(res.body.Qty).toBe(5);
    });

    it('GET /master/bill-of-materials - should list all bill of materials', async () => {
      const res = await request(app.getHttpServer())
        .get('/master/bill-of-materials')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /master/bill-of-materials/:finishGoodId - should get by finish good id', async () => {
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-BOM-002',
          PartName: 'BOM Test FG 2',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/master/bill-of-materials/${fg.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /master/bill-of-materials/material/:materialId - should get by material id', async () => {
      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-BOM-002',
          PartName: 'BOM Test Material 2',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/master/bill-of-materials/material/${material.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('PATCH /master/bill-of-materials/:id - should update bill of materials', async () => {
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-BOM-003',
          PartName: 'BOM Update Test',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });
      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-BOM-003',
          PartName: 'BOM Update Material',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const bom = await prisma.billOfMaterials.create({
        data: { FinishGoodId: fg.Id, MaterialId: material.Id, Qty: 3 },
      });

      const res = await request(app.getHttpServer())
        .patch(`/master/bill-of-materials/${bom.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ qty: 10 })
        .expect(200);

      expect(res.body.Qty).toBe(10);
    });

    it('DELETE /master/bill-of-materials/:id - should delete bill of materials', async () => {
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-BOM-004',
          PartName: 'BOM Delete Test',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });
      const material = await prisma.material.create({
        data: {
          PartNumber: 'MAT-BOM-004',
          PartName: 'BOM Delete Material',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const bom = await prisma.billOfMaterials.create({
        data: { FinishGoodId: fg.Id, MaterialId: material.Id, Qty: 2 },
      });

      await request(app.getHttpServer())
        .delete(`/master/bill-of-materials/${bom.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ============================================
  // BOX QTY TESTS
  // ============================================
  describe('/master/box-qty (BoxQty)', () => {
    it('POST /master/box-qty - should create box qty', async () => {
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-BOX-001',
          PartName: 'Box Test FG',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/master/box-qty')
        .set('Authorization', `Bearer ${token}`)
        .send({
          partNumber: fg.PartNumber,
          qty: 12,
        })
        .expect(201);

      expect(res.body.PartNumber).toBe(fg.PartNumber);
      expect(res.body.Qty).toBe(12);
    });

    it('GET /master/box-qty - should list all box qty', async () => {
      const res = await request(app.getHttpServer())
        .get('/master/box-qty')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /master/box-qty/:id - should get box qty by id', async () => {
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-BOX-002',
          PartName: 'Box Test FG 2',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });
      const boxQty = await prisma.boxQTY.create({
        data: {
          PartNumber: fg.PartNumber,
          Qty: 10,
          CreatedBy: 'TEST',
          UpdatedBy: 'TEST',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/master/box-qty/${boxQty.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Id).toBe(boxQty.Id);
    });

    it('GET /master/box-qty/part-number/:partNumber - should get by part number', async () => {
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-BOX-003',
          PartName: 'Box Test FG 3',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });
      await prisma.boxQTY.create({
        data: {
          PartNumber: fg.PartNumber,
          Qty: 8,
          CreatedBy: 'TEST',
          UpdatedBy: 'TEST',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/master/box-qty/part-number/${fg.PartNumber}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.PartNumber).toBe(fg.PartNumber);
    });

    it('PATCH /master/box-qty/:id - should update box qty', async () => {
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-BOX-004',
          PartName: 'Box Update Test',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });
      const boxQty = await prisma.boxQTY.create({
        data: {
          PartNumber: fg.PartNumber,
          Qty: 5,
          CreatedBy: 'TEST',
          UpdatedBy: 'TEST',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/master/box-qty/${boxQty.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ qty: 20 })
        .expect(200);

      expect(res.body.Qty).toBe(20);
    });

    it('DELETE /master/box-qty/:id - should delete box qty', async () => {
      const fg = await prisma.finishGood.create({
        data: {
          PartNumber: 'FG-BOX-005',
          PartName: 'Box Delete Test',
          CreatedBy: 'admin',
          UpdatedBy: 'admin',
        },
      });
      const boxQty = await prisma.boxQTY.create({
        data: {
          PartNumber: fg.PartNumber,
          Qty: 3,
          CreatedBy: 'TEST',
          UpdatedBy: 'TEST',
        },
      });

      await request(app.getHttpServer())
        .delete(`/master/box-qty/${boxQty.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ============================================
  // MAN POWER TESTS
  // ============================================
  describe('/master/man-power (ManPower)', () => {
    it('POST /master/man-power - should create man power', async () => {
      const res = await request(app.getHttpServer())
        .post('/master/man-power')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nik: 'EMP001',
          name: 'John Doe',
          status: true,
          line: 'LINE-A',
        })
        .expect(201);

      expect(res.body.Nik).toBe('EMP001');
    });

    it('GET /master/man-power - should list all man power', async () => {
      await prisma.manPower.create({
        data: {
          Nik: 'EMP002',
          Name: 'Jane Doe',
          Uid: 'uid-jane',
          CreatedBy: 'TEST',
          UpdatedBy: 'TEST',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/master/man-power')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /master/man-power/nik/:nik - should get by NIK', async () => {
      await prisma.manPower.create({
        data: {
          Nik: 'NIK-TEST',
          Name: 'Test Worker',
          Uid: 'uid-test',
          CreatedBy: 'TEST',
          UpdatedBy: 'TEST',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/master/man-power/nik/NIK-TEST')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Nik).toBe('NIK-TEST');
    });

    it('PATCH /master/man-power/:uid - should update man power', async () => {
      const created = await prisma.manPower.create({
        data: {
          Nik: 'EMP003',
          Name: 'Old Name',
          Uid: 'uid-old',
          CreatedBy: 'TEST',
          UpdatedBy: 'TEST',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/master/man-power/${created.Uid}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body.Name).toBe('New Name');
    });

    it('DELETE /master/man-power/:uid - should delete man power', async () => {
      const created = await prisma.manPower.create({
        data: {
          Nik: 'EMP-DEL',
          Name: 'To Delete',
          Uid: 'uid-delete',
          CreatedBy: 'TEST',
          UpdatedBy: 'TEST',
        },
      });

      await request(app.getHttpServer())
        .delete(`/master/man-power/${created.Uid}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
