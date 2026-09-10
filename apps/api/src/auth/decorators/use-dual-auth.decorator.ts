import { applyDecorators, UseGuards } from '@nestjs/common';
import { DualAuthGuard } from '../guards/dual-auth.guard';

/**
 * UseDualAuth - Decorator to apply DualAuthGuard to a route or controller
 *
 * This guard supports BOTH authentication methods:
 * 1. X-Api-Key header
 * 2. Authorization: Bearer <token> header
 *
 * Usage:
 *
 * // On a controller (all routes will use dual auth)
 * @UseDualAuth()
 * @Controller('users')
 * export class UserController {}
 *
 * // On a specific route
 * @Get()
 * getUsers() {}
 *
 * // Combine with @Public() to skip auth
 * @Get('public-data')
 * @Public()
 * getPublicData() {}
 */
export const UseDualAuth = () => applyDecorators(UseGuards(DualAuthGuard));
