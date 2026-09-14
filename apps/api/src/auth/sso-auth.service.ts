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
} from '@vuteq/sso-client-nest';
import { PrismaService } from '../prisma/prisma.service';

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
        resolveAuthorization: (identity) => this.resolveAuthorization(identity),
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

  private async resolveAuthorization(identity: VuteqIdentity) {
    const email = identity.email ?? `${identity.id}@sso.invalid`;
    const name = identity.name ?? identity.username ?? identity.id;
    const existingBySsoId = await this.prisma.mTCUserManagement.findUnique({
      where: { SsoObjectId: identity.id },
    });
    const existingByEmail = existingBySsoId
      ? null
      : await this.prisma.mTCUserManagement.findUnique({
          where: { Email: email },
        });
    const existing = existingBySsoId ?? existingByEmail;
    const user = existing
      ? await this.prisma.mTCUserManagement.update({
          where: { Id: existing.Id },
          data: {
            UserId: identity.id,
            SsoObjectId: identity.id,
            Name: name,
            Email: email,
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
            RoleId: null,
            LastLogin: new Date(),
          },
          include: { Role: { include: { Permission: true } } },
        });
    if (!user.IsActive) throw new Error('User account is inactive');
    return {
      roles: user.Role ? [user.Role.RoleName] : [],
      permissions:
        user.Role?.Permission.map((permission) => permission.Action) ?? [],
      attributes: { roleId: user.RoleId },
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
