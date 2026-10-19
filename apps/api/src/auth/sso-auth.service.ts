import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VuteqSsoService,
  type VuteqAuthContext,
  type VuteqIdentity,
  type VuteqAccessClaims,
} from '@vuteq/sso-client-nest';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type SsoUserWithAuthorization = Prisma.MTCUserManagementGetPayload<{
  include: { Role: { include: { Permission: true } } };
}>;

@Injectable()
export class SsoAuthService implements OnModuleInit {
  private readonly logger = new Logger(SsoAuthService.name);
  private readonly service?: VuteqSsoService;
  private available = false;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    if (configService.get<string>('VUTEQ_SSO_ENABLED') === 'false') {
      this.logger.warn('Vuteq SSO authentication is disabled by configuration');
      return;
    }

    try {
      const allowedClientIds = (
        configService.get<string>('VUTEQ_SSO_ALLOWED_CLIENT_IDS') ?? ''
      )
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      this.service = new VuteqSsoService({
        baseUrl: configService.get<string>('VUTEQ_SSO_BASE_URL') ?? '',
        secret: configService.get<string>('VUTEQ_SSO_SECRET') ?? '',
        allowedClientIds,
        global: false,
        resolveAuthorization: (identity, claims) =>
          this.resolveAuthorization(identity, claims),
      });
    } catch (error) {
      this.logUnavailable(error);
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.service) return;

    try {
      await this.service.metadata();
      this.available = true;
      this.logger.log('Vuteq SSO authentication is available');
    } catch (error) {
      this.logUnavailable(error);
    }
  }

  async authenticate(authorization: string): Promise<VuteqAuthContext> {
    if (!this.service || !this.available) {
      throw new ServiceUnavailableException(
        'Vuteq SSO authentication is unavailable',
      );
    }
    return this.service.authenticate(authorization);
  }

  private async resolveAuthorization(
    identity: VuteqIdentity,
    claims?: VuteqAccessClaims,
  ) {
    const email = identity.email ?? `${identity.id}@sso.invalid`;
    const name = identity.name ?? identity.username ?? identity.id;
    const isRoAdmin = claims?.roles?.includes('RO_ADMINISTRATOR') ?? false;

    const existingBySsoId = await this.prisma.mTCUserManagement.findUnique({
      where: { SsoObjectId: identity.id },
      include: { Role: { include: { Permission: true } } },
    });
    const existingByEmail = existingBySsoId
      ? null
      : await this.prisma.mTCUserManagement.findUnique({
          where: { Email: email },
          include: { Role: { include: { Permission: true } } },
        });
    const existing = existingBySsoId ?? existingByEmail;
    const auditActor = identity.username ?? identity.email ?? identity.id;

    let readonlyRole: Prisma.MTCRoleGetPayload<{
      include: { Permission: true };
    }> | null = null;
    if (isRoAdmin && (!existing || !existing.RoleId || !existing.Role)) {
      readonlyRole = await this.prisma.mTCRole.findUnique({
        where: { RoleName: 'READONLY' },
        include: { Permission: true },
      });
    }

    const roleIdToAssign =
      existing?.RoleId ?? (isRoAdmin && readonlyRole ? readonlyRole.Id : null);

    const user: SsoUserWithAuthorization = existing
      ? await this.prisma.mTCUserManagement.update({
          where: { Id: existing.Id },
          data: {
            UserId: identity.id,
            SsoObjectId: identity.id,
            Name: name,
            Email: email,
            RoleId: roleIdToAssign,
            LastLogin: new Date(),
          },
          include: { Role: { include: { Permission: true } } },
        })
      : await this.prisma.mTCUserManagement.create({
          data: {
            UserId: identity.id,
            SsoObjectId: identity.id,
            Name: name,
            Email: email,
            RoleId: roleIdToAssign,
            LastLogin: new Date(),
            CreatedBy: auditActor,
            UpdatedBy: auditActor,
          },
          include: { Role: { include: { Permission: true } } },
        });
    if (!user.IsActive) throw new Error('User account is inactive');

    const effectiveRole = user.Role ?? (isRoAdmin ? readonlyRole : null);
    let permissions =
      effectiveRole?.Permission.map((permission) => permission.Action) ?? [];

    if (isRoAdmin && permissions.length === 0) {
      const readPermissions = await this.prisma.mTCPermission.findMany({
        where: {
          OR: [{ Action: { endsWith: '_READ' } }, { Action: 'DASHBOARD_VIEW' }],
        },
      });
      permissions = readPermissions.map((permission) => permission.Action);
    }

    return {
      roles: effectiveRole
        ? [effectiveRole.RoleName]
        : isRoAdmin
          ? ['READONLY']
          : [],
      permissions,
      attributes: { roleId: user.RoleId ?? effectiveRole?.Id ?? null },
    };
  }

  private logUnavailable(error: unknown): void {
    const details = error as { name?: unknown; code?: unknown };
    this.logger.error(
      JSON.stringify({
        event: 'sso_startup_degraded',
        errorName:
          typeof details.name === 'string' ? details.name : 'UnknownError',
        errorCode: typeof details.code === 'string' ? details.code : undefined,
      }),
    );
  }
}
