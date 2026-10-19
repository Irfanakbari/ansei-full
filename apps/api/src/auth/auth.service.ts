import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MTCAuthAction, MTCAuthStatus } from '../generated/prisma/enums';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createAuthLog(data: {
    userId?: string;
    emailAttempt?: string;
    action: MTCAuthAction;
    status: MTCAuthStatus;
    failureReason?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.prisma.mTCAuthLog.create({
      data: {
        UserId: data.userId,
        EmailAttempt: data.emailAttempt,
        Action: data.action,
        Status: data.status,
        FailureReason: data.failureReason,
        IpAddress: data.ipAddress,
        UserAgent: data.userAgent,
      },
    });
  }

  async getUserWithPermissions(
    ssoSubject: string,
    globalRoles?: string[],
  ): Promise<UserEntity | null> {
    const user =
      (await this.prisma.mTCUserManagement.findUnique({
        where: { SsoObjectId: ssoSubject },
        include: { Role: { include: { Permission: true } } },
      })) ??
      (await this.prisma.mTCUserManagement.findUnique({
        where: { UserId: ssoSubject },
        include: { Role: { include: { Permission: true } } },
      }));
    if (!user) return null;

    let roleName = user.Role?.RoleName ?? null;
    let permissions =
      user.Role?.Permission.map((permission) => permission.Action) ?? [];
    let accessStatus: 'ACTIVE' | 'PENDING' =
      user.RoleId === null || !user.Role ? 'PENDING' : 'ACTIVE';

    const isRoAdmin = globalRoles?.includes('RO_ADMINISTRATOR') ?? false;

    if (isRoAdmin && (!roleName || accessStatus === 'PENDING')) {
      const readonlyRole = await this.prisma.mTCRole.findUnique({
        where: { RoleName: 'READONLY' },
        include: { Permission: true },
      });
      if (readonlyRole) {
        roleName = readonlyRole.RoleName;
        permissions = readonlyRole.Permission.map((p) => p.Action);
        accessStatus = 'ACTIVE';

        if (!user.RoleId) {
          await this.prisma.mTCUserManagement.update({
            where: { Id: user.Id },
            data: { RoleId: readonlyRole.Id },
          });
        }
      } else {
        const readPermissions = await this.prisma.mTCPermission.findMany({
          where: {
            OR: [
              { Action: { endsWith: '_READ' } },
              { Action: 'DASHBOARD_VIEW' },
            ],
          },
        });
        roleName = 'READONLY';
        permissions = readPermissions.map((p) => p.Action);
        accessStatus = 'ACTIVE';
      }
    }

    return {
      UserId: user.UserId,
      Name: user.Name,
      Email: user.Email,
      LastLogin: user.LastLogin,
      RoleName: roleName,
      Permission: permissions,
      AccessStatus: accessStatus,
    };
  }
}
