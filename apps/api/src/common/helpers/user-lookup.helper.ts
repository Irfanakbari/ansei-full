/* By Irfan Akbari Vuteq Indonesia - 2026-09-15 */
import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';

const logger = new Logger('UserLookup');

export const getUserEmail = async (
  userId: string,
  prisma: PrismaService,
): Promise<string | null> => {
  try {
    const res = await prisma.mTCUserManagement.findUnique({
      where: { UserId: userId },
      select: { Email: true },
    });
    return res?.Email || null;
  } catch {
    logger.error('User email lookup failed');
    return null;
  }
};

export const getUserName = async (
  userId: string,
  prisma: PrismaService,
): Promise<string | null> => {
  try {
    const res = await prisma.mTCUserManagement.findUnique({
      where: { UserId: userId },
      select: { Name: true },
    });
    return res?.Name || null;
  } catch {
    logger.error('User name lookup failed');
    return userId;
  }
};

export const getUserDisplayNameMap = async (
  userIds: Iterable<string | null | undefined>,
  prisma: PrismaService,
): Promise<Map<string, string>> => {
  const ids = [
    ...new Set(
      [...userIds].filter(
        (userId): userId is string => Boolean(userId) && userId !== 'SYSTEM',
      ),
    ),
  ];
  const names = new Map<string, string>([['SYSTEM', 'System']]);
  if (ids.length === 0) return names;

  try {
    const users = await prisma.mTCUserManagement.findMany({
      where: {
        OR: [
          { UserId: { in: ids } },
          { SsoObjectId: { in: ids } },
          { Id: { in: ids } },
        ],
      },
      select: { Id: true, UserId: true, SsoObjectId: true, Name: true },
    });
    for (const user of users) {
      names.set(user.UserId, user.Name);
      if (user.SsoObjectId) names.set(user.SsoObjectId, user.Name);
      if (user.Id) names.set(user.Id, user.Name);
    }
  } catch {
    logger.warn('User display-name lookup failed');
  }
  return names;
};

export const getUserDisplayName = (
  userId: string | null | undefined,
  names: ReadonlyMap<string, string>,
): string =>
  (userId ? names.get(userId) : undefined) ??
  (userId === 'SYSTEM' || !userId ? 'System' : userId);

export const getUserPhone = async (
  userId: string,
  prisma: PrismaService,
): Promise<string | null> => {
  try {
    const res = await prisma.mTCUserManagement.findUnique({
      where: { UserId: userId },
      select: { PhoneNumber: true },
    });
    return res?.PhoneNumber || null;
  } catch {
    logger.error('User phone lookup failed');
    return null;
  }
};
