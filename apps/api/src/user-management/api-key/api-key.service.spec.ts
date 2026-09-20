import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKeyService } from './api-key.service';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  const prisma = {
    mTCUserManagement: { findUnique: jest.fn() },
    apiKey: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiKeyService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ApiKeyService);
  });

  it('generates at least 128 bits of random API key material', async () => {
    prisma.mTCUserManagement.findUnique.mockResolvedValue({ IsActive: true });
    prisma.apiKey.create.mockImplementation(({ data }) =>
      Promise.resolve({
        Id: 'key-1',
        ...data,
        CreatedAt: new Date(),
      }),
    );

    const result = await service.create(
      { userId: 'user-1', name: 'Integration' },
      'admin',
    );

    expect(result.ApiKey).toMatch(/^ansei_api_[a-f0-9]{32}$/);
    expect(result).not.toHaveProperty('KeyHash');
  });

  it('omits KeyHash from list queries', async () => {
    prisma.apiKey.count.mockResolvedValue(0);
    prisma.apiKey.findMany.mockResolvedValue([]);

    await service.findAll({ page: 1, limit: 10 });

    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ omit: { KeyHash: true } }),
    );
  });

  it.each([
    ['findOne', true],
    ['revoke', true],
    ['reactivate', false],
  ] as const)('omits KeyHash from %s responses', async (method, isActive) => {
    prisma.apiKey.findUnique.mockResolvedValue({
      Id: 'key-1',
      IsActive: isActive,
    });
    prisma.apiKey.update.mockResolvedValue({ Id: 'key-1' });

    await service[method]('key-1', 'admin');

    const operation =
      method === 'findOne' ? prisma.apiKey.findUnique : prisma.apiKey.update;
    expect(operation).toHaveBeenLastCalledWith(
      expect.objectContaining({ omit: { KeyHash: true } }),
    );
  });
});
