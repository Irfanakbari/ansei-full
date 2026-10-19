import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permission.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (
      user &&
      (user.globalRoles?.includes('SUPER_ADMINISTRATOR') ||
        user.roleName === 'SUPER' ||
        user.permissions?.includes('SUPER'))
    ) {
      return true;
    }

    if (!user || !user.permissions) {
      return false;
    }

    // RO_ADMINISTRATOR from global SSO or local READONLY role has authority for all read-only endpoints
    if (
      (user.globalRoles?.includes('RO_ADMINISTRATOR') ||
        user.roleName === 'READONLY') &&
      requiredPermissions.some(
        (permission) =>
          permission.endsWith('_READ') ||
          permission.endsWith('_VIEW') ||
          permission === 'DASHBOARD_VIEW',
      )
    ) {
      return true;
    }

    // Check if user has at least one required permission (OR)
    return requiredPermissions.some((permission) =>
      user.permissions.includes(permission),
    );
  }
}
