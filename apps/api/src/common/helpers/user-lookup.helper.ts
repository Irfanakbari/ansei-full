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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getUserDisplayNameMap = async (
  userIds: Iterable<string | null | undefined>,
  prisma: PrismaService,
): Promise<Map<string, string>> => {
  const ids = [
    ...new Set(
      [...userIds]
        .map((id) => (typeof id === 'string' ? id.trim() : ''))
        .filter(
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
          { Email: { in: ids } },
        ],
      },
      select: {
        Id: true,
        UserId: true,
        SsoObjectId: true,
        Email: true,
        Name: true,
      },
    });
    for (const user of users) {
      if (user.UserId) names.set(user.UserId, user.Name);
      if (user.SsoObjectId) names.set(user.SsoObjectId, user.Name);
      if (user.Id) names.set(user.Id, user.Name);
      if (user.Email) names.set(user.Email, user.Name);
    }
  } catch {
    logger.warn('User display-name lookup failed');
  }
  return names;
};

export const getUserDisplayName = (
  userId: string | null | undefined,
  names: ReadonlyMap<string, string>,
): string => {
  if (!userId) return 'System';
  if (userId === 'SYSTEM') return 'System';
  const trimmed = userId.trim();
  const found = names.get(trimmed) ?? names.get(userId);
  if (found) return found;
  if (UUID_REGEX.test(trimmed)) return '-';
  return trimmed;
};

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
