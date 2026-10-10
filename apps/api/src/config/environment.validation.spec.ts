import { validateEnvironment } from './environment.validation';

const productionEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@database:5432/ansei',
  REDIS_HOST: 'redis',
  VUTEQ_SSO_ENABLED: 'false',
  ERROR_LOG_STORAGE_PATH: '/app/storage/error-logs',
};

describe('validateEnvironment', () => {
  it('validates the shared SAP session encryption key without exposing it', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        SAP_SESSION_CACHE_KEY: 'ab'.repeat(32),
      }),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        SAP_SESSION_CACHE_KEY: '',
      }),
    ).not.toThrow();
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        SAP_SESSION_CACHE_KEY: 'sensitive-value',
      }),
    ).toThrow('SAP_SESSION_CACHE_KEY must contain 64 hexadecimal characters');
    try {
      validateEnvironment({
        ...productionEnvironment,
        SAP_SESSION_CACHE_KEY: 'sensitive-value',
      });
    } catch (error) {
      expect(String(error)).not.toContain('sensitive-value');
    }
  });
  it('accepts a minimal production configuration with optional integrations disabled', () => {
    expect(validateEnvironment({ ...productionEnvironment })).toEqual(
      productionEnvironment,
    );
  });

  it('requires enabled integration settings without exposing values', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        SMTP_ENABLED: 'true',
        SMTP_PASS: 'sensitive-value',
      }),
    ).toThrow('SMTP_HOST is required');
    try {
      validateEnvironment({
        ...productionEnvironment,
        SMTP_ENABLED: 'true',
        SMTP_PASS: 'sensitive-value',
      });
    } catch (error) {
      expect(String(error)).not.toContain('sensitive-value');
    }
  });

  it('rejects insecure production URLs and invalid ports', () => {
    expect(() =>
      validateEnvironment({
        ...productionEnvironment,
        PORT: '70000',
        VUTEQ_SSO_ENABLED: 'true',
        VUTEQ_SSO_BASE_URL: 'http://sso.example.test',
        VUTEQ_SSO_SECRET: 'secret',
      }),
    ).toThrow('must use HTTPS in production');
  });
});
