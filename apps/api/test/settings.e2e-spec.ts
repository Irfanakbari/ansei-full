import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

describe('Settings E2E', () => {
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
      'MASTER_READ',
      'MASTER_CREATE',
      'MASTER_UPDATE',
      'MASTER_DELETE',
    ],
    departments: ['Admin'],
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
    // Cleanup - EmailNotification.Name is String, use startsWith filter
    await prisma.emailNotification.deleteMany({
      where: { Name: { startsWith: 'TEST-' } },
    });
  });

  describe('/settings/dashboard-setting (Dashboard Setting)', () => {
    it('GET /settings/dashboard-setting - should list all dashboard settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/settings/dashboard-setting')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /settings/dashboard-setting/latest - should get latest dashboard setting', async () => {
      // Create a setting first so latest endpoint returns data
      await prisma.dashboardSetting.create({
        data: {
          StartDate: new Date(),
          EndDate: new Date(),
          UpdatedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get('/settings/dashboard-setting/latest')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('GET /settings/dashboard-setting/:id - should get dashboard setting by id', async () => {
      // Create a setting first
      const setting = await prisma.dashboardSetting.create({
        data: {
          StartDate: new Date(),
          EndDate: new Date(),
          UpdatedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/settings/dashboard-setting/${setting.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Id).toBe(setting.Id);
    });

    it('PATCH /settings/dashboard-setting/:id - should update dashboard setting', async () => {
      const setting = await prisma.dashboardSetting.create({
        data: {
          StartDate: new Date(),
          EndDate: new Date(),
          UpdatedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/settings/dashboard-setting/${setting.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ StartDate: new Date(), EndDate: new Date() })
        .expect(200);

      expect(res.body.Id).toBe(setting.Id);
    });
  });

  describe('/settings/email-notification (Email Notification)', () => {
    it('POST /settings/email-notification - should create email notification', async () => {
      const res = await request(app.getHttpServer())
        .post('/settings/email-notification')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'TEST-EN-001',
          email: 'test@example.com',
        })
        .expect(201);

      expect(res.body.Name).toBe('TEST-EN-001');
    });

    it('GET /settings/email-notification - should list all email notifications', async () => {
      await prisma.emailNotification.create({
        data: {
          Name: 'TEST-EN-LIST-001',
          Email: 'test1@example.com',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/settings/email-notification')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /settings/email-notification/:id - should get email notification by id', async () => {
      const created = await prisma.emailNotification.create({
        data: {
          Name: 'TEST-EN-GET-001',
          Email: 'test2@example.com',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/settings/email-notification/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Id).toBe(created.Id);
    });

    it('GET /settings/email-notification/email/:email - should get by email', async () => {
      await prisma.emailNotification.create({
        data: {
          Name: 'TEST-EN-EMAIL-001',
          Email: 'unique@example.com',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/settings/email-notification/email/unique@example.com')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.Email).toBe('unique@example.com');
    });

    it('PATCH /settings/email-notification/:id - should update email notification', async () => {
      const created = await prisma.emailNotification.create({
        data: {
          Name: 'TEST-EN-UPD-001',
          Email: 'test3@example.com',
        },
      });

      const res = await request(app.getHttpServer())
        .patch(`/settings/email-notification/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.Name).toBe('Updated Name');
    });

    it('DELETE /settings/email-notification/:id - should delete email notification', async () => {
      const created = await prisma.emailNotification.create({
        data: {
          Name: 'TEST-EN-DEL-001',
          Email: 'test4@example.com',
        },
      });

      await request(app.getHttpServer())
        .delete(`/settings/email-notification/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
