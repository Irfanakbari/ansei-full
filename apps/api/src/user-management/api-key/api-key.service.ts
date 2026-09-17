import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import * as crypto from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import { ApiKeyQueryDto } from './dto/api-key-query.dto';

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

    // 3. Generate API Key: ansei_api_ + 32 random hex chars
    const randomPart = crypto.randomBytes(16).toString('hex');
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
  async findAll(query: ApiKeyQueryDto) {
    const where: Prisma.ApiKeyWhereInput = {
      ...(query.userId ? { UserId: query.userId } : {}),
      ...(query.isActive !== undefined ? { IsActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { Name: { contains: query.search, mode: 'insensitive' } },
              { Description: { contains: query.search, mode: 'insensitive' } },
              { UserId: { contains: query.search, mode: 'insensitive' } },
              { CreatedBy: { contains: query.search, mode: 'insensitive' } },
              {
                User: {
                  is: {
                    OR: [
                      { Name: { contains: query.search, mode: 'insensitive' } },
                      {
                        Email: {
                          contains: query.search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [totalItems, data] = await Promise.all([
      this.prisma.apiKey.count({ where }),
      this.prisma.apiKey.findMany({
        where,
        omit: { KeyHash: true },
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
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: Math.ceil(totalItems / query.limit),
      },
    };
  }

  /**
   * Get single API Key by ID
   */
  async findOne(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { Id: id },
      omit: { KeyHash: true },
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
      omit: { KeyHash: true },
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
      omit: { KeyHash: true },
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
