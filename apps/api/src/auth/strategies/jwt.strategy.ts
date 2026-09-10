import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'default-secret-key-change-in-production',
    });
  }

  async validate(payload: any) {
    // Load user with role and permissions
    const user = await this.prisma.mTCUserManagement.findUnique({
      where: { UserId: payload.username },
      include: {
        Role: {
          include: {
            Permission: true,
          },
        },
      },
    });

    if (!user || !user.IsActive) {
      throw new UnauthorizedException();
    }

    // Validate active session
    if (payload.sessionId) {
      const session = await this.prisma.mTCUserSession.findUnique({
        where: { SessionId: payload.sessionId },
      });

      if (!session || !session.IsActive || session.ExpiresAt < new Date()) {
        throw new UnauthorizedException('Session expired or revoked');
      }
    } else {
      // For backward compatibility or if sessionId is missing
      throw new UnauthorizedException('Invalid session');
    }

    // Extract permission actions into a flat array
    const permissions = user.Role?.Permission.map((p) => p.Action);

    return {
      username: user.UserId,
      name: user.Name,
      email: user.Email,
      roleId: user.RoleId,
      roleName: user.Role?.RoleName,
      sessionId: payload.sessionId,
      permissions,
    };
  }
}
