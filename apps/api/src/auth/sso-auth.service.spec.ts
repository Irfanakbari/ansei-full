import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VuteqSsoService } from '@vuteq/sso-client-nest';
import { PrismaService } from '../prisma/prisma.service';
import { SsoAuthService } from './sso-auth.service';

jest.mock('@vuteq/sso-client-nest', () => ({
  VuteqSsoService: jest.fn(),
}));

describe(SsoAuthService.name, () => {
  const prisma = {} as PrismaService;
  const config = (values: Record<string, string>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not construct the SDK when SSO is explicitly disabled', async () => {
    const service = new SsoAuthService(
      config({ VUTEQ_SSO_ENABLED: 'false' }),
      prisma,
    );

    await service.onModuleInit();

    expect(VuteqSsoService).not.toHaveBeenCalled();
    await expect(service.authenticate('Bearer token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('degrades startup when SDK configuration is invalid', async () => {
    jest.mocked(VuteqSsoService).mockImplementationOnce(() => {
      throw new Error('invalid secret');
    });
    const service = new SsoAuthService(
      config({
        VUTEQ_SSO_BASE_URL: 'https://sso.example.test',
        VUTEQ_SSO_SECRET: 'invalid',
      }),
      prisma,
    );

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.authenticate('Bearer token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('degrades startup when SSO rejects bootstrap', async () => {
    jest.mocked(VuteqSsoService).mockImplementationOnce(
      () =>
        ({
          metadata: jest.fn().mockRejectedValue(new Error('rejected')),
        }) as unknown as VuteqSsoService,
    );
    const service = new SsoAuthService(
      config({
        VUTEQ_SSO_BASE_URL: 'https://sso.example.test',
        VUTEQ_SSO_SECRET: 'registered-secret-value',
      }),
      prisma,
    );

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.authenticate('Bearer token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('enables bearer authentication only after bootstrap succeeds', async () => {
    const authenticate = jest.fn().mockResolvedValue({ user: { id: 'user' } });
    jest.mocked(VuteqSsoService).mockImplementationOnce(
      () =>
        ({
          metadata: jest.fn().mockResolvedValue({ clientId: 'ansei' }),
          authenticate,
        }) as unknown as VuteqSsoService,
    );
    const service = new SsoAuthService(
      config({
        VUTEQ_SSO_BASE_URL: 'https://sso.example.test',
        VUTEQ_SSO_SECRET: 'registered-secret-value',
      }),
      prisma,
    );

    await service.onModuleInit();
    await service.authenticate('Bearer token');

    expect(authenticate).toHaveBeenCalledWith('Bearer token');
  });

  it('parses and passes explicitly allowed SSO client IDs', () => {
    jest
      .mocked(VuteqSsoService)
      .mockImplementationOnce(
        () => ({ metadata: jest.fn() }) as unknown as VuteqSsoService,
      );

    new SsoAuthService(
      config({
        VUTEQ_SSO_BASE_URL: 'https://sso.example.test',
        VUTEQ_SSO_SECRET: 'registered-secret-value',
        VUTEQ_SSO_ALLOWED_CLIENT_IDS: ' ipcs-web, ipcs-app, ,',
      }),
      prisma,
    );

    expect(VuteqSsoService).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedClientIds: ['ipcs-web', 'ipcs-app'],
      }),
    );
  });

  it('passes an empty allowlist when the environment is absent', () => {
    jest
      .mocked(VuteqSsoService)
      .mockImplementationOnce(
        () => ({ metadata: jest.fn() }) as unknown as VuteqSsoService,
      );

    new SsoAuthService(
      config({
        VUTEQ_SSO_BASE_URL: 'https://sso.example.test',
        VUTEQ_SSO_SECRET: 'registered-secret-value',
      }),
      prisma,
    );

    expect(VuteqSsoService).toHaveBeenCalledWith(
      expect.objectContaining({ allowedClientIds: [] }),
    );
  });
});
