import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a new API Key for a user
   * Returns the raw API key (ONLY TIME it's visible)
   */
  async create(dto: CreateApiKeyDto, createdBy: string) {
    // 1. Verify user exists
    const user = await this.prisma.mTCUserManagement.findUnique({
      where: { UserId: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${dto.userId}' not found`);
    }

    // 2. Check if user is active
    if (!user.IsActive) {
      throw new BadRequestException(
        `User '${dto.userId}' is inactive. Cannot create API Key for inactive user.`,
      );
    }

    // 3. Generate API Key: ansei_api_ + 16 random hex chars
    const randomPart = crypto.randomBytes(8).toString('hex');
    const rawKey = `ansei_api_${randomPart}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = 'ansei_api_';

    // 4. Save to database
    const apiKey = await this.prisma.apiKey.create({
      data: {
        KeyHash: keyHash,
        KeyPrefix: keyPrefix,
        Name: dto.name,
        Description: dto.description,
        UserId: dto.userId,
        CreatedBy: createdBy,
      },
    });

    // 5. Return with raw key (ONLY TIME it's visible!)
    return {
      Id: apiKey.Id,
      Name: apiKey.Name,
      ApiKey: rawKey, // Full key - SHOW ONLY ONCE!
      KeyPrefix: apiKey.KeyPrefix,
      UserId: apiKey.UserId,
      CreatedAt: apiKey.CreatedAt,
      CreatedBy: apiKey.CreatedBy,
    };
  }

  /**
   * List all API Keys with optional filters
   */
  findAll(filter?: { userId?: string; isActive?: boolean }) {
    const where: Record<string, string | boolean> = {};
    if (filter?.userId) where.UserId = filter.userId;
    if (filter?.isActive !== undefined) where.IsActive = filter.isActive;

    return this.prisma.apiKey.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      include: {
        User: {
          select: {
            UserId: true,
            Name: true,
            Email: true,
            IsActive: true,
          },
        },
      },
      orderBy: { CreatedAt: 'desc' },
    });
  }

  /**
   * Get single API Key by ID
   */
  async findOne(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { Id: id },
      include: {
        User: {
          select: {
            UserId: true,
            Name: true,
            Email: true,
            IsActive: true,
          },
        },
      },
    });

    if (!apiKey) {
      throw new NotFoundException(`API Key with ID '${id}' not found`);
    }

    return apiKey;
  }

  /**
   * Revoke an API Key (set IsActive = false)
   */
  async revoke(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { Id: id },
    });

    if (!apiKey) {
      throw new NotFoundException(`API Key with ID '${id}' not found`);
    }

    if (!apiKey.IsActive) {
      throw new BadRequestException('API Key is already revoked');
    }

    return this.prisma.apiKey.update({
      where: { Id: id },
      data: { IsActive: false },
      include: {
        User: {
          select: {
            UserId: true,
            Name: true,
            Email: true,
          },
        },
      },
    });
  }

  /**
   * Reactivate a revoked API Key
   */
  async reactivate(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { Id: id },
    });

    if (!apiKey) {
      throw new NotFoundException(`API Key with ID '${id}' not found`);
    }

    if (apiKey.IsActive) {
      throw new BadRequestException('API Key is already active');
    }

    return this.prisma.apiKey.update({
      where: { Id: id },
      data: { IsActive: true },
      include: {
        User: {
          select: {
            UserId: true,
            Name: true,
            Email: true,
          },
        },
      },
    });
  }

  /**
   * Find API Key by hash and include user with role and permissions
   * Used by ApiKeyStrategy for authentication
   */
  findByHash(keyHash: string) {
    return this.prisma.apiKey.findUnique({
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
  }

  /**
   * Update LastUsedAt for an API Key (fire and forget)
   */
  updateLastUsed(id: string) {
    return this.prisma.apiKey.update({
      where: { Id: id },
      data: { LastUsedAt: new Date() },
    });
  }

  /**
   * Delete an API Key permanently
   */
  async delete(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { Id: id },
    });

    if (!apiKey) {
      throw new NotFoundException(`API Key with ID '${id}' not found`);
    }

    await this.prisma.apiKey.delete({
      where: { Id: id },
    });

    return { message: 'API Key deleted successfully' };
  }
}
