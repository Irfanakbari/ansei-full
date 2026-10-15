import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: {
    mTCUserManagement: {
      findUnique: jest.Mock;
    };
    mTCAuthLog: {
      create: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      mTCUserManagement: {
        findUnique: jest.fn(),
      },
      mTCAuthLog: {
        create: jest.fn(),
      },
    };
    authService = new AuthService(prisma as unknown as PrismaService);
  });

  describe('getUserWithPermissions', () => {
    it('returns null if user is not found', async () => {
      prisma.mTCUserManagement.findUnique.mockResolvedValue(null);

      const result = await authService.getUserWithPermissions('unknown-sso');
      expect(result).toBeNull();
    });

    it('returns PENDING status when user has no role assigned', async () => {
      prisma.mTCUserManagement.findUnique.mockResolvedValue({
        UserId: 'user-01',
        Name: 'Test User',
        Email: 'user@example.com',
        LastLogin: new Date('2026-10-15T00:00:00.000Z'),
        RoleId: null,
        Role: null,
      });

      const result = await authService.getUserWithPermissions('user-01');

      expect(result).toEqual({
        UserId: 'user-01',
        Name: 'Test User',
        Email: 'user@example.com',
        LastLogin: expect.any(Date),
        RoleName: null,
        Permission: [],
        AccessStatus: 'PENDING',
      });
    });

    it('returns ACTIVE status when user has an active role assigned', async () => {
      prisma.mTCUserManagement.findUnique.mockResolvedValue({
        UserId: 'admin-01',
        Name: 'Admin User',
        Email: 'admin@example.com',
        LastLogin: new Date('2026-10-15T00:00:00.000Z'),
        RoleId: 1,
        Role: {
          RoleName: 'ADMIN',
          Permission: [{ Action: 'MASTER_READ' }, { Action: 'MASTER_CREATE' }],
        },
      });

      const result = await authService.getUserWithPermissions('admin-01');

      expect(result).toEqual({
        UserId: 'admin-01',
        Name: 'Admin User',
        Email: 'admin@example.com',
        LastLogin: expect.any(Date),
        RoleName: 'ADMIN',
        Permission: ['MASTER_READ', 'MASTER_CREATE'],
        AccessStatus: 'ACTIVE',
      });
    });
  });
});
