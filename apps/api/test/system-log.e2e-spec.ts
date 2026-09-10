import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

describe('System Log E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let token: string;

  const mockUser = {
    sub: 'admin',
    username: 'admin',
    name: 'Admin User',
    email: 'admin@test.com',
    permissions: ['SYSTEM_LOG_READ'],
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
    // Cleanup
    await prisma.logProcessDetail.deleteMany({
      where: { ProcessId: { startsWith: 'TEST_' } },
    });
    await prisma.logProcess.deleteMany({
      where: { ProcessId: { startsWith: 'TEST_' } },
    });
  });

  describe('/system-log (System Log)', () => {
    it('GET /system-log - should list all process logs', async () => {
      // Create test log process
      await prisma.logProcess.create({
        data: {
          ProcessId: 'TEST-PROCESS-001',
          FunctionId: 'TEST_001',
          FunctionName: 'Test Function',
          ProcessStatus: 'SUCCESS',
          ProcessStart: new Date(),
          ProcessDate: new Date(),
          CreatedAt: new Date(),
          CreatedBy: 'admin',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/system-log')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(typeof res.body.data === 'object').toBe(true);
    });

    it('GET /system-log/inventory-ledger - should list all inventory ledger records', async () => {
      const res = await request(app.getHttpServer())
        .get('/system-log/inventory-ledger')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(typeof res.body.data === 'object').toBe(true);
    });

    it('GET /system-log/:id - should get process log by id', async () => {
      const created = await prisma.logProcess.create({
        data: {
          ProcessId: 'TEST-PROCESS-002',
          FunctionId: 'TEST_002',
          FunctionName: 'Test Function 2',
          ProcessStatus: 'SUCCESS',
          ProcessStart: new Date(),
          ProcessDate: new Date(),
          CreatedAt: new Date(),
          CreatedBy: 'admin',
        },
      });

      // Create detail
      await prisma.logProcessDetail.create({
        data: {
          ProcessId: created.ProcessId,
          MessageId: 'COMM-001',
          Message: 'Test message',
          Type: 'INFO',
          Location: 'test.ts:1',
          ProcessDate: new Date(),
          CreatedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/system-log/${created.ProcessId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.ProcessId).toBe('TEST-PROCESS-002');
    });
  });
});
