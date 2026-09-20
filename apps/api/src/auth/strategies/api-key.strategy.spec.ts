import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeyStrategy } from './api-key.strategy';

describe('ApiKeyStrategy', () => {
  let strategy: ApiKeyStrategy;
  const prisma = {
    apiKey: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiKeyStrategy, { provide: PrismaService, useValue: prisma }],
    }).compile();
    strategy = module.get(ApiKeyStrategy);
  });

  it('attributes the last-used lifecycle update to the API key owner', async () => {
    prisma.apiKey.findUnique.mockResolvedValue({
      Id: 'key-1',
      UserId: 'owner-1',
      IsActive: true,
      User: {
        UserId: 'owner-1',
        Name: 'API Owner',
        Email: 'owner@example.com',
        IsActive: true,
        RoleId: 1,
        Role: { RoleName: 'Integration', Permission: [] },
      },
    });
    prisma.apiKey.update.mockResolvedValue({ Id: 'key-1' });

    await strategy.validate('ansei_api_secret');
    await Promise.resolve();

    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { Id: 'key-1' },
      data: {
        LastUsedAt: expect.any(Date),
        UpdatedBy: 'owner-1',
      },
    });
    expect(prisma.apiKey.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ KeyHash: expect.anything() }),
      }),
    );
  });

  it('does not update usage metadata when the key is invalid', async () => {
    prisma.apiKey.findUnique.mockResolvedValue(null);

    await expect(strategy.validate('invalid')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(prisma.apiKey.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          KeyHash: crypto.createHash('sha256').update('invalid').digest('hex'),
        },
      }),
    );
    expect(prisma.apiKey.update).not.toHaveBeenCalled();
  });
});
