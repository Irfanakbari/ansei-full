import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { MTCAuthAction, MTCAuthStatus } from '../generated/prisma/enums';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

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

  async createSession(userId: string, ipAddress: string, userAgent: string) {
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '24h';
    // Simple duration parser: '24h' -> 24 * 60 * 60 * 1000
    let durationMs = 24 * 60 * 60 * 1000;
    if (expiresIn.endsWith('h')) {
      durationMs = parseInt(expiresIn) * 60 * 60 * 1000;
    } else if (expiresIn.endsWith('d')) {
      durationMs = parseInt(expiresIn) * 24 * 60 * 60 * 1000;
    } else if (expiresIn.endsWith('m')) {
      durationMs = parseInt(expiresIn) * 60 * 1000;
    }

    return this.prisma.mTCUserSession.create({
      data: {
        UserId: userId,
        IpAddress: ipAddress,
        UserAgent: userAgent,
        IsActive: true,
        ExpiresAt: new Date(Date.now() + durationMs),
      },
    });
  }

  async revokeSession(
    sessionId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const session = await this.prisma.mTCUserSession.update({
      where: { SessionId: sessionId },
      data: { IsActive: false },
    });

    await this.createAuthLog({
      userId: userId || session.UserId,
      action: MTCAuthAction.LOGOUT,
      status: MTCAuthStatus.SUCCESS,
      ipAddress,
      userAgent,
    });

    return session;
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    try {
      const user = await this.validateUser(
        loginDto.username,
        loginDto.password,
      );

      if (!user) {
        await this.createAuthLog({
          emailAttempt: loginDto.username,
          action: MTCAuthAction.LOGIN,
          status: MTCAuthStatus.FAILED,
          failureReason: 'Invalid credentials',
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      // Create session
      const session = await this.createSession(
        user.UserId,
        ipAddress || 'Unknown',
        userAgent || 'Unknown',
      );

      // Create log
      await this.createAuthLog({
        userId: user.UserId,
        action: MTCAuthAction.LOGIN,
        status: MTCAuthStatus.SUCCESS,
        ipAddress,
        userAgent,
      });

      // Update last login
      await this.prisma.mTCUserManagement.update({
        where: { UserId: user.UserId },
        data: { LastLogin: new Date() },
      });

      const payload = {
        username: user.UserId,
        sub: user.UserId,
        sessionId: session.SessionId,
      };
      return {
        AccessToken: this.jwtService.sign(payload),
        User: {
          UserId: user.UserId,
          Name: user.Name,
          Email: user.Email,
          RoleName: user.Role.RoleName,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async loginWithAzureAdToken(
    accessToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      // Fetch user profile from Microsoft Graph API using the access token
      const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!graphResponse.ok) {
        let errorData;
        try {
          errorData = await graphResponse.json();
        } catch (e) {}
        console.error(
          'Failed to fetch from Microsoft Graph:',
          errorData || graphResponse.statusText,
        );

        await this.createAuthLog({
          action: MTCAuthAction.SSO_CALLBACK,
          status: MTCAuthStatus.FAILED,
          failureReason: 'Invalid Azure AD token',
          ipAddress,
          userAgent,
        });

        throw new UnauthorizedException('Invalid Azure AD token');
      }

      const graphData = await graphResponse.json();

      const email =
        graphData.userPrincipalName?.toLowerCase() ||
        graphData.mail?.toLowerCase();
      const ssoObjectId = graphData.id;

      if (!email && !ssoObjectId) {
        await this.createAuthLog({
          action: MTCAuthAction.SSO_CALLBACK,
          status: MTCAuthStatus.FAILED,
          failureReason: 'Could not retrieve user details from Azure AD',
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException(
          'Could not retrieve user details from Azure AD',
        );
      }

      const user = await this.prisma.mTCUserManagement.findFirst({
        where: {
          OR: [{ SsoObjectId: ssoObjectId }, { Email: email }],
        },
        include: { Role: true },
      });

      if (!user) {
        await this.createAuthLog({
          emailAttempt: email,
          action: MTCAuthAction.SSO_CALLBACK,
          status: MTCAuthStatus.FAILED,
          failureReason: 'User not found in system or unauthorized',
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException(
          'User not found in system or unauthorized',
        );
      }

      // Create session
      const session = await this.createSession(
        user.UserId,
        ipAddress || 'Unknown',
        userAgent || 'Unknown',
      );

      // Create log
      await this.createAuthLog({
        userId: user.UserId,
        action: MTCAuthAction.SSO_CALLBACK,
        status: MTCAuthStatus.SUCCESS,
        ipAddress,
        userAgent,
      });

      // Update last login
      await this.prisma.mTCUserManagement.update({
        where: { Id: user.Id },
        data: { LastLogin: new Date() },
      });

      const payload = {
        username: user.UserId,
        sub: user.UserId,
        sessionId: session.SessionId,
      };

      return {
        AccessToken: this.jwtService.sign(payload),
        User: {
          UserId: user.UserId,
          Name: user.Name,
          Email: user.Email,
          RoleName: user.Role?.RoleName,
        },
      };
    } catch (error) {
      throw new UnauthorizedException(
        'Authentication failed: ' + error.message,
      );
    }
  }

  async loginSso(ssoUser: any, ipAddress?: string, userAgent?: string) {
    try {
      const user = await this.prisma.mTCUserManagement.findUnique({
        where: { Id: ssoUser.Id },
        include: { Role: true },
      });

      if (!user) {
        await this.createAuthLog({
          action: MTCAuthAction.SSO_CALLBACK,
          status: MTCAuthStatus.FAILED,
          failureReason: 'SSO User not found in database',
          ipAddress,
          userAgent,
        });
        return null;
      }

      // Create session
      const session = await this.createSession(
        user.UserId,
        ipAddress || 'Unknown',
        userAgent || 'Unknown',
      );

      // Create log
      await this.createAuthLog({
        userId: user.UserId,
        action: MTCAuthAction.SSO_CALLBACK,
        status: MTCAuthStatus.SUCCESS,
        ipAddress,
        userAgent,
      });

      // Update last login
      await this.prisma.mTCUserManagement.update({
        where: { Id: user.Id },
        data: { LastLogin: new Date() },
      });

      const payload = {
        username: user.UserId,
        sub: user.UserId,
        sessionId: session.SessionId,
      };

      return {
        AccessToken: this.jwtService.sign(payload),
        User: {
          UserId: user.UserId,
          Name: user.Name,
          Email: user.Email,
          RoleName: user.Role?.RoleName,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.prisma.mTCUserManagement.findUnique({
      where: { UserId: username },
      include: {
        Role: true,
      },
    });

    if (!user || !user.IsActive) {
      return null;
    }

    if (!user.Password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.Password);
    if (!isPasswordValid) {
      return null;
    }
    return user;
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async getUserWithPermissions(username: string) {
    const user = await this.prisma.mTCUserManagement.findUnique({
      where: { UserId: username },
      include: {
        Role: {
          include: {
            Permission: true,
          },
        },
      },
    });
    if (!user) {
      return null;
    }

    const { Password, ...result } = user;
    return {
      UserId: result.UserId,
      Name: result.Name,
      Email: result.Email,
      LastLogin: result.LastLogin,
      RoleName: result.Role?.RoleName ?? null,
      Permission: result.Role?.Permission.map((p) => p.Action) ?? null,
    };
  }

  async getActiveSessions(userId: string, roleName: string) {
    const now = new Date();

    if (roleName === 'SUPER') {
      return this.prisma.mTCUserSession.findMany({
        where: {
          IsActive: true,
          ExpiresAt: { gte: now },
        },
        orderBy: { CreatedAt: 'desc' },
      });
    }

    return this.prisma.mTCUserSession.findMany({
      where: {
        UserId: userId,
        IsActive: true,
        ExpiresAt: { gte: now },
      },
      orderBy: { CreatedAt: 'desc' },
    });
  }
}
