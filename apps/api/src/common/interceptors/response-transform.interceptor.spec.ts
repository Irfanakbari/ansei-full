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
});
