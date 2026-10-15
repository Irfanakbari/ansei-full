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

  async getUserWithPermissions(ssoSubject: string): Promise<UserEntity | null> {
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

    return {
      UserId: user.UserId,
      Name: user.Name,
      Email: user.Email,
      LastLogin: user.LastLogin,
      RoleName: user.Role?.RoleName ?? null,
      Permission:
        user.Role?.Permission.map((permission) => permission.Action) ?? [],
      AccessStatus: user.RoleId === null || !user.Role ? 'PENDING' : 'ACTIVE',
    };
  }
}
