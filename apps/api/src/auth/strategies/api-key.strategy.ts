import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { ICurrentUser } from '../interfaces/current-user.interface';

/**
 * ApiKeyStrategy - Strategy for validating API Key authentication
 * This is NOT a Passport strategy, it's a custom strategy class used by DualAuthGuard
 */
@Injectable()
export class ApiKeyStrategy {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate API Key and return user info
   * @param apiKey - The raw API key from request header
   * @returns ICurrentUser object if valid
   * @throws UnauthorizedException if invalid
   */
  async validate(apiKey: string): Promise<ICurrentUser> {
    // 1. Hash the incoming API key with SHA-256
    const keyHash = this.hashApiKey(apiKey);

    // 2. Find API Key in database with user and role relations
    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { KeyHash: keyHash },
      include: {
        User: {
          include: {
            Role: {
              include: {
                Permission: true,
              },
            },
          },
        },
      },
    });

    // 3. Check if API Key exists
    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid API Key');
    }

    // 4. Check if API Key is active
    if (!apiKeyRecord.IsActive) {
      throw new UnauthorizedException('API Key has been revoked');
    }

    // 5. Check if user is active
    if (!apiKeyRecord.User.IsActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // 6. Extract permissions from user's role
    const permissions =
      apiKeyRecord.User.Role?.Permission?.map((p) => p.Action) || [];

    // 7. Update LastUsedAt (fire and forget, don't await)
    this.prisma.apiKey
      .update({
        where: { Id: apiKeyRecord.Id },
        data: {
          LastUsedAt: new Date(),
          UpdatedBy: apiKeyRecord.UserId,
        } as never,
      })
      .catch(() => {
        // Silently ignore update failures
      });

    // 8. Return user object with same structure as JWT auth
    return {
      username: apiKeyRecord.User.UserId,
      name: apiKeyRecord.User.Name,
      email: apiKeyRecord.User.Email,
      roleId: apiKeyRecord.User.RoleId,
      roleName: apiKeyRecord.User.Role?.RoleName,
      permissions,
      departments: [],
      authType: 'API_KEY',
      sourceId: apiKeyRecord.Id,
      sessionId: '', // API_KEY doesn't use session
    };
  }

  /**
   * Hash API key using SHA-256
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }
}
