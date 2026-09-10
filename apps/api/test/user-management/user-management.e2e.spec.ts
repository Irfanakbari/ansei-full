import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../src/auth/guards/permissions.guard';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';

describe('User Management E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let token: string;

  const mockUser = {
    sub: 'admin',
    username: 'admin',
    name: 'Admin User',
    email: 'admin@test.com',
    permissions: ['USER_MANAGEMENT'],
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
    // Cleanup in reverse order of dependencies
    await prisma.mTCUserSession.deleteMany({ where: {} });
    await prisma.mTCUserManagement.deleteMany({
      where: { UserId: { not: 'admin' } },
    });
    await prisma.mTCRole.deleteMany({
      where: { RoleName: { startsWith: 'TEST_' } },
    });
    await prisma.mTCPermission.deleteMany({
      where: { Action: { startsWith: 'TEST_' } },
    });
  });

  // ============================================
  // PERMISSION TESTS
  // ============================================
  describe('/permissions (Permission)', () => {
    it('POST /permissions - should create permission', async () => {
      const res = await request(app.getHttpServer())
        .post('/permissions')
        .set('Authorization', `Bearer ${token}`)
        .send({ Action: 'TEST_CREATE', Description: 'Test permission' })
        .expect(201);

      expect(res.body.Action).toBe('TEST_CREATE');
      expect(res.body.Id).toBeDefined();
    });

    it('GET /permissions - should list all permissions', async () => {
      // Create a permission first
      await prisma.mTCPermission.create({
        data: { Action: 'TEST_LIST', Description: 'List test' },
      });

      const res = await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('PATCH /permissions/:id - should update permission', async () => {
      const created = await prisma.mTCPermission.create({
        data: { Action: 'TEST_UPDATE', Description: 'Original' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/permissions/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ Description: 'Updated' })
        .expect(200);

      expect(res.body.Description).toBe('Updated');
    });

    it('DELETE /permissions/:id - should delete permission', async () => {
      const created = await prisma.mTCPermission.create({
        data: { Action: 'TEST_DELETE', Description: 'To delete' },
      });

      await request(app.getHttpServer())
        .delete(`/permissions/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  // ============================================
  // ROLE TESTS
  // ============================================
  describe('/roles (Role)', () => {
    it('POST /roles - should create role', async () => {
      const res = await request(app.getHttpServer())
        .post('/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ RoleName: 'TEST_ADMIN', Description: 'Test admin role' })
        .expect(201);

      expect(res.body.RoleName).toBe('TEST_ADMIN');
      expect(res.body.Id).toBeDefined();
    });

    it('GET /roles - should list all roles', async () => {
      await prisma.mTCRole.create({
        data: { RoleName: 'TEST_VIEWER', Description: 'Test viewer role' },
      });

      const res = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('PATCH /roles/:id - should update role', async () => {
      const created = await prisma.mTCRole.create({
        data: { RoleName: 'TEST_EDITOR', Description: 'Original' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/roles/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ Description: 'Updated description' })
        .expect(200);

      expect(res.body.Description).toBe('Updated description');
    });

    it('DELETE /roles/:id - should delete role', async () => {
      const created = await prisma.mTCRole.create({
        data: { RoleName: 'TEST_DELETABLE', Description: 'To delete' },
      });

      await request(app.getHttpServer())
        .delete(`/roles/${created.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('POST /roles/:roleId/permissions - should assign permission to role', async () => {
      const role = await prisma.mTCRole.create({
        data: {
          RoleName: 'TEST_ROLE_PERM',
          Description: 'Role for permission test',
        },
      });
      const permission = await prisma.mTCPermission.create({
        data: {
          Action: 'TEST_ROLE_PERM_ACTION',
          Description: 'Permission for role',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/roles/${role.Id}/permissions`)
        .set('Authorization', `Bearer ${token}`)
        .send({ permissionId: permission.Id })
        .expect(201);

      expect(res.body.message).toBe('Permission assigned to role');
    });

    it('DELETE /roles/:roleId/permissions/:permissionId - should remove permission from role', async () => {
      const role = await prisma.mTCRole.create({
        data: {
          RoleName: 'TEST_ROLE_REMOVE',
          Description: 'Role for remove test',
        },
      });
      const permission = await prisma.mTCPermission.create({
        data: {
          Action: 'TEST_REMOVE_ACTION',
          Description: 'Permission to remove',
        },
      });

      // First assign
      await prisma.mTCRole.update({
        where: { Id: role.Id },
        data: { Permission: { connect: { Id: permission.Id } } },
      });

      const res = await request(app.getHttpServer())
        .delete(`/roles/${role.Id}/permissions/${permission.Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.message).toBe('Permission removed from role');
    });
  });

  // ============================================
  // USER TESTS
  // ============================================
  describe('/users (User)', () => {
    it('POST /users - should create user', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          UserId: 'testuser001',
          Password: 'Password123!',
          Name: 'Test User',
          Email: 'testuser001@test.com',
        })
        .expect(201);

      expect(res.body.UserId).toBe('testuser001');
      expect(res.body.Name).toBe('Test User');
      expect(res.body.Password).toBeUndefined(); // Password should not be returned
    });

    it('GET /users - should list all users', async () => {
      await prisma.mTCUserManagement.create({
        data: {
          UserId: 'testuser002',
          Password: 'hashed',
          Name: 'Test User 2',
          Email: 'testuser002@test.com',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('PATCH /users/:id - should update user', async () => {
      await prisma.mTCUserManagement.create({
        data: {
          UserId: 'testuser003',
          Password: 'hashed',
          Name: 'Original Name',
          Email: 'testuser003@test.com',
        },
      });

      const res = await request(app.getHttpServer())
        .patch('/users/testuser003')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.message).toBe('User updated successfully');
    });

    it('PATCH /users/password/:id - should update user password', async () => {
      await prisma.mTCUserManagement.create({
        data: {
          UserId: 'testuser004',
          Password: 'hashed',
          Name: 'Password Test User',
          Email: 'testuser004@test.com',
        },
      });

      const res = await request(app.getHttpServer())
        .patch('/users/password/testuser004')
        .set('Authorization', `Bearer ${token}`)
        .send({ Password: 'NewPassword123!' })
        .expect(200);

      expect(res.body.message).toBe('User updated successfully');
    });

    it('POST /users/:id/roles - should assign role to user', async () => {
      const role = await prisma.mTCRole.create({
        data: { RoleName: 'TEST_USER_ROLE', Description: 'User role test' },
      });

      await prisma.mTCUserManagement.create({
        data: {
          UserId: 'testuser005',
          Password: 'hashed',
          Name: 'Role Assign Test User',
          Email: 'testuser005@test.com',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/users/testuser005/roles')
        .set('Authorization', `Bearer ${token}`)
        .send({ roleId: role.Id })
        .expect(201);

      expect(res.body.message).toBe('Role assigned successfully');
    });

    it('DELETE /users/:id/roles/:roleId - should remove role from user', async () => {
      const role = await prisma.mTCRole.create({
        data: {
          RoleName: 'TEST_USER_ROLE_REMOVE',
          Description: 'Role remove test',
        },
      });

      await prisma.mTCUserManagement.create({
        data: {
          UserId: 'testuser006',
          Password: 'hashed',
          Name: 'Role Remove Test User',
          Email: 'testuser006@test.com',
          RoleId: role.Id,
        },
      });

      const res = await request(app.getHttpServer())
        .delete('/users/testuser006/roles/' + role.Id)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.message).toBe('Role removed successfully');
    });

    it('DELETE /users/:id - should delete user', async () => {
      await prisma.mTCUserManagement.create({
        data: {
          UserId: 'testuser007',
          Password: 'hashed',
          Name: 'Delete Test User',
          Email: 'testuser007@test.com',
        },
      });

      const res = await request(app.getHttpServer())
        .delete('/users/testuser007')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.message).toBe('User deleted successfully');
    });
  });
});
