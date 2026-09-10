import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { ApiKeyStrategy } from '../strategies/api-key.strategy';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permission.decorator';
import type { ICurrentUser } from '../interfaces/current-user.interface';

/**
 * DualAuthGuard - Supports both JWT Bearer Token and X-Api-Key authentication
 *
 * Authentication priority:
 * 1. X-Api-Key header (or x-essa-api-key for backward compatibility)
 * 2. Authorization: Bearer <token> header
 *
 * Usage:
 * - Use @Public() decorator to skip authentication entirely
 * - Use @Permission() decorator to require specific permissions
 * - Without @Permission(), the endpoint is accessible to any authenticated user
 */
@Injectable()
export class DualAuthGuard implements CanActivate {
  constructor(
    private jwtAuthGuard: JwtAuthGuard,
    private apiKeyStrategy: ApiKeyStrategy,
    private permissionsGuard: PermissionsGuard,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check for @Public() decorator - skip all auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Extract auth headers
    const rawApiKey =
      request.headers['x-api-key'] || request.headers['x-essa-api-key'];
    const apiKey = Array.isArray(rawApiKey) ? rawApiKey[0] : rawApiKey;
    const authHeader = request.headers['authorization'];

    try {
      if (apiKey) {
        // API Key Authentication
        const user = await this.apiKeyStrategy.validate(apiKey as string);
        request.user = user;
        return this.checkPermissions(context, user);
      }

      if (authHeader?.toLowerCase().startsWith('bearer ')) {
        // JWT Authentication - delegate to existing JWT guard
        const canActivate = await this.jwtAuthGuard.canActivate(context);
        if (!canActivate) return false;

        // JWT guard validated successfully, now check permissions
        return this.permissionsGuard.canActivate(context);
      }

      throw new UnauthorizedException(
        'Missing authentication credentials. Provide either X-Api-Key header or Authorization: Bearer token.',
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Check if user has required permissions
   * Superuser (roleName = 'SUPER' or has 'SUPER' permission) bypasses permission check
   */
  private checkPermissions(
    context: ExecutionContext,
    user: ICurrentUser,
  ): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Superuser bypass
    if (user.roleName === 'SUPER' || user.permissions?.includes('SUPER')) {
      return true;
    }

    if (!user || !user.permissions) {
      return false;
    }

    // Check if user has at least one required permission (OR logic)
    return requiredPermissions.some((permission) =>
      user.permissions.includes(permission),
    );
  }
}
