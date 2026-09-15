import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
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
    ]);
    const mockPrisma = {
      mTCUserManagement: { findMany },
    } as any;

    const enrichingInterceptor = new ResponseTransformInterceptor(mockPrisma);
    const rawData = [
      { id: 1, CreatedBy: 'admin', ReceivedBy: 'user1' },
      { id: 2, createdBy: 'admin', updatedBy: 'user1' },
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
    ]);
  });
});
