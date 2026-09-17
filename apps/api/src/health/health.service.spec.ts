import { ConfigService } from '@nestjs/config';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const config = new ConfigService({
    REDIS_REQUIRED: 'false',
    VUTEQ_SSO_ENABLED: 'false',
    NAS_ENABLED: 'false',
    SMTP_ENABLED: 'false',
    PRINTER_ENABLED: 'false',
    DOCUMENT_CONVERTER_ENABLED: 'false',
  });

  it('keeps liveness independent of dependencies', () => {
    const service = new HealthService({} as never, config);
    expect(service.liveness()).toEqual({ status: 'alive' });
  });

  it('is ready when PostgreSQL is available and optional dependencies are disabled', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const result = await new HealthService(prisma as never, config).readiness();
    expect(result.status).toBe('ready');
    expect(result.checks.database).toEqual({ status: 'up', required: true });
    expect(result.checks.sso.status).toBe('disabled');
  });

  it('is not ready when PostgreSQL is unavailable without exposing the error', async () => {
    const prisma = {
      $queryRawUnsafe: jest
        .fn()
        .mockRejectedValue(new Error('postgresql://secret@internal')),
    };
    const result = await new HealthService(prisma as never, config).readiness();
    expect(result.status).toBe('not_ready');
    expect(JSON.stringify(result)).not.toContain('internal');
  });
});
