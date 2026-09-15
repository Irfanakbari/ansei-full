/* By Irfan Akbari Vuteq Indonesia - 2026-09-15 */
import type { PrismaService } from '../../prisma/prisma.service';
import {
  getUserDisplayName,
  getUserDisplayNameMap,
  getUserName,
} from './user-lookup.helper';

describe('user lookup helper', () => {
  it('maps both local user ID, SSO subject, and Id to the user name', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        Id: 'uuid-1',
        UserId: 'local-user',
        SsoObjectId: 'long-sso-subject',
        Name: 'Irfan Akbari',
      },
    ]);
    const prisma = {
      mTCUserManagement: { findMany },
    } as unknown as PrismaService;

    const names = await getUserDisplayNameMap(
      ['local-user', 'long-sso-subject', 'uuid-1', 'SYSTEM'],
      prisma,
    );

    expect(getUserDisplayName('local-user', names)).toBe('Irfan Akbari');
    expect(getUserDisplayName('long-sso-subject', names)).toBe('Irfan Akbari');
    expect(getUserDisplayName('uuid-1', names)).toBe('Irfan Akbari');
    expect(getUserDisplayName('SYSTEM', names)).toBe('System');
    expect(getUserDisplayName('missing-user', names)).toBe('missing-user');
    expect(getUserDisplayName(undefined, names)).toBe('System');
  });

  it('returns safe display fallbacks when the lookup is unavailable', async () => {
    const prisma = {
      mTCUserManagement: {
        findMany: jest
          .fn()
          .mockRejectedValue(new Error('database unavailable')),
      },
    } as unknown as PrismaService;

    const names = await getUserDisplayNameMap(['unresolved-user'], prisma);

    expect(getUserDisplayName('unresolved-user', names)).toBe(
      'unresolved-user',
    );
    expect(getUserDisplayName('SYSTEM', names)).toBe('System');
  });

  it('getUserName fetches single user name or falls back to userId', async () => {
    const findUnique = jest.fn().mockResolvedValue({ Name: 'Admin Name' });
    const prisma = {
      mTCUserManagement: { findUnique },
    } as unknown as PrismaService;

    const name = await getUserName('admin', prisma);
    expect(name).toBe('Admin Name');

    const errorPrisma = {
      mTCUserManagement: {
        findUnique: jest.fn().mockRejectedValue(new Error('error')),
      },
    } as unknown as PrismaService;

    const fallbackName = await getUserName('admin', errorPrisma);
    expect(fallbackName).toBe('admin');
  });
});
