import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  Version,
  VERSION_NEUTRAL,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import type { ICurrentUser } from 'src/auth/interfaces/current-user.interface';
import { Public } from './decorators/public.decorator';

import { LoginResponseDto } from './dto/login-response.dto';
import { UserEntity } from './entities/user.entity';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private extractIpAddress(req: any): string {
    let ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress;

    if (ip && ip.startsWith('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }

    return ip || 'Unknown';
  }

  private extractUserAgent(req: any): string {
    return (
      req.headers['x-user-agent'] || req.headers['user-agent'] || 'Unknown'
    );
  }

  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 201, type: LoginResponseDto })
  @Public()
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: any,
  ): Promise<LoginResponseDto> {
    const ipAddress = this.extractIpAddress(req);
    const userAgent = this.extractUserAgent(req);
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @ApiOperation({ summary: 'Memicu halaman login SSO Microsoft' })
  @Public()
  @UseGuards(AuthGuard('microsoft'))
  @Version(VERSION_NEUTRAL)
  @Get('microsoft')
  async microsoftAuth(@Req() req) {}

  @ApiOperation({
    summary:
      'Endpoint callback untuk token pertukaran dari Frontend SSO Azure AD',
  })
  @ApiResponse({
    status: 201,
    type: LoginResponseDto,
    description: 'SSO login berhasil',
  })
  @ApiResponse({ status: 401, description: 'Token tidak valid' })
  @Public()
  @Version(VERSION_NEUTRAL)
  @Post('sso-callback')
  async azureAdTokenExchange(@Body('token') token: string, @Req() req: any) {
    if (!token) {
      throw new UnauthorizedException('Token is required');
    }
    const ipAddress = this.extractIpAddress(req);
    const userAgent = this.extractUserAgent(req);
    return this.authService.loginWithAzureAdToken(token, ipAddress, userAgent);
  }

  @ApiOperation({ summary: 'Callback dari Microsoft setelah login sukses' })
  @Public()
  @UseGuards(AuthGuard('microsoft'))
  @Version(VERSION_NEUTRAL)
  @Get('microsoft/callback')
  async microsoftAuthRedirect(@Req() req, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    try {
      const ipAddress = this.extractIpAddress(req);
      const userAgent = this.extractUserAgent(req);
      const loginResponse = await this.authService.loginSso(
        req.user,
        ipAddress,
        userAgent,
      );

      if (!loginResponse) {
        return res.redirect(`${frontendUrl}/auth/sso-success?ssoError=true`);
      }

      return res.redirect(
        `${frontendUrl}/auth/sso-success?token=${loginResponse.AccessToken}`,
      );
    } catch (error) {
      return res.redirect(`${frontendUrl}/auth/sso-success?ssoError=true`);
    }
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout / revoke session' })
  @ApiResponse({ status: 201, description: 'Session berhasil di-revoke' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('logout')
  async logout(@CurrentUser() user: ICurrentUser, @Req() req: any) {
    const ipAddress = this.extractIpAddress(req);
    const userAgent = this.extractUserAgent(req);
    return this.authService.revokeSession(
      user.sessionId,
      user.username,
      ipAddress,
      userAgent,
    );
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, type: UserEntity })
  @Get('profile')
  async getProfile(
    @CurrentUser() user: ICurrentUser,
  ): Promise<Omit<UserEntity, 'RoleName'> | null> {
    return this.authService.getUserWithPermissions(user.username);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get active sessions - SUPER sees all, others see only their own',
  })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  @Get('sessions')
  async getActiveSessions(@CurrentUser() user: ICurrentUser) {
    return this.authService.getActiveSessions(
      user.username,
      user.roleName ?? '',
    );
  }
}
