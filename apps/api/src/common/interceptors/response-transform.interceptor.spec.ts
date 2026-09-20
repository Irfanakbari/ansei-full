import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { lastValueFrom, of } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { ResponseTransformInterceptor } from './response-transform.interceptor';

describe('ResponseTransformInterceptor', () => {
  const interceptor = new ResponseTransformInterceptor();

  function context(statusCode = 200): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl: '/v1/system-log' }),
        getResponse: () => ({
          statusCode,
          headersSent: false,
          getHeader: () => undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('wraps regular payloads and preserves falsy values', async () => {
    const handler: CallHandler<number> = { handle: () => of(0) };

    await expect(
      lastValueFrom(interceptor.intercept(context(), handler)),
    ).resolves.toMatchObject({
      success: true,
      statusCode: 200,
      data: 0,
      path: '/v1/system-log',
    });
  });

  it('promotes canonical service metadata beside data', async () => {
    const result = {
      data: [{ id: 'ledger-1' }],
      meta: { page: 1, limit: 50, totalItems: 1, totalPages: 1 },
    };
    const handler: CallHandler<typeof result> = { handle: () => of(result) };

    await expect(
      lastValueFrom(interceptor.intercept(context(), handler)),
    ).resolves.toMatchObject({
      data: result.data,
      meta: result.meta,
    });
  });

  it('does not wrap no-content responses', async () => {
    const handler: CallHandler<undefined> = { handle: () => of(undefined) };

    await expect(
      lastValueFrom(interceptor.intercept(context(204), handler)),
    ).resolves.toBeUndefined();
  });

  it('enriches audit fields with user display names when prisma is available', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { UserId: 'admin', SsoObjectId: 'sso-1', Name: 'Administrator' },
      { UserId: 'user1', SsoObjectId: 'sso-2', Name: 'User One' },
      {
        Id: 'a08f7a91-c49c-4969-aba0-b5d51fabbeaa',
        UserId: 'a08f7a91-c49c-4969-aba0-b5d51fabbeaa',
        SsoObjectId: 'a08f7a91-c49c-4969-aba0-b5d51fabbeaa',
        Name: 'Irfan Akbari',
      },
    ]);
    const mockPrisma = {
      mTCUserManagement: { findMany },
    } as any;

    const enrichingInterceptor = new ResponseTransformInterceptor(mockPrisma);
    const rawData = [
      {
        id: 1,
        CreatedBy: 'admin',
        LastEditedBy: 'user1',
        ReceivedBy: 'user1',
      },
      { id: 2, createdBy: 'admin', updatedBy: 'user1' },
      {
        id: 3,
        CreatedBy: 'a08f7a91-c49c-4969-aba0-b5d51fabbeaa',
      },
      {
        id: 4,
        CreatedBy: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      },
    ];
    const handler: CallHandler<typeof rawData> = { handle: () => of(rawData) };

    const result = (await lastValueFrom(
      enrichingInterceptor.intercept(context(), handler),
    )) as any;

    expect(result.data).toEqual([
      {
        id: 1,
        CreatedBy: 'admin',
        CreatedByName: 'Administrator',
        LastEditedBy: 'user1',
        UpdatedBy: 'user1',
        UpdatedByName: 'User One',
        ReceivedBy: 'user1',
        ReceivedByName: 'User One',
      },
      {
        id: 2,
        createdBy: 'admin',
        createdByName: 'Administrator',
        updatedBy: 'user1',
        updatedByName: 'User One',
      },
      {
        id: 3,
        CreatedBy: 'a08f7a91-c49c-4969-aba0-b5d51fabbeaa',
        CreatedByName: 'Irfan Akbari',
      },
      {
        id: 4,
        CreatedBy: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        CreatedByName: '-',
      },
    ]);
  });

  it('can be instantiated via NestJS dependency injection with PrismaService', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ResponseTransformInterceptor,
        {
          provide: PrismaService,
          useValue: {
            mTCUserManagement: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    const resolved = moduleRef.get(ResponseTransformInterceptor);
    expect(resolved).toBeDefined();
    // Verify prisma property is indeed injected
    expect((resolved as any).prisma).toBeDefined();
  });
});
