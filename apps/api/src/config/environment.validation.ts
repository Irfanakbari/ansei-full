type Environment = Record<string, string | undefined>;

const TRUE_VALUES = new Set(['true', '1']);
const FALSE_VALUES = new Set(['false', '0']);

function enabled(
  environment: Environment,
  name: string,
  fallback: boolean,
): boolean {
  const value = environment[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (TRUE_VALUES.has(value)) return true;
  if (FALSE_VALUES.has(value)) return false;
  throw new Error(
    `Invalid environment configuration: ${name} must be true or false`,
  );
}

function required(
  environment: Environment,
  names: string[],
  errors: string[],
): void {
  for (const name of names) {
    if (!environment[name]?.trim()) errors.push(`${name} is required`);
  }
}

function port(
  environment: Environment,
  name: string,
  errors: string[],
  fallback?: number,
): void {
  const raw = environment[name]?.trim();
  if (!raw && fallback !== undefined) return;
  const value = Number(raw);
  if (!raw || !Number.isInteger(value) || value < 1 || value > 65535) {
    errors.push(`${name} must be an integer between 1 and 65535`);
  }
}

function url(
  environment: Environment,
  name: string,
  errors: string[],
  https: boolean,
): void {
  const raw = environment[name]?.trim();
  if (!raw) return;
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push(`${name} must be a valid HTTP URL`);
      return;
    }
    if (https && parsed.protocol !== 'https:') {
      errors.push(`${name} must use HTTPS in production`);
    }
  } catch {
    errors.push(`${name} must be a valid HTTP URL`);
  }
}

export function validateEnvironment(environment: Environment): Environment {
  const errors: string[] = [];
  const production = environment.NODE_ENV === 'production';
  required(environment, ['DATABASE_URL'], errors);
  port(environment, 'PORT', errors, 7500);

  const redisRequired = enabled(environment, 'REDIS_REQUIRED', true);
  if (redisRequired) required(environment, ['REDIS_HOST'], errors);
  port(environment, 'REDIS_PORT', errors, 6379);

  const ssoEnabled = enabled(environment, 'VUTEQ_SSO_ENABLED', true);
  if (ssoEnabled) {
    required(environment, ['VUTEQ_SSO_BASE_URL', 'VUTEQ_SSO_SECRET'], errors);
    url(environment, 'VUTEQ_SSO_BASE_URL', errors, production);
  }

  const nasEnabled = enabled(environment, 'NAS_ENABLED', false);
  if (nasEnabled) {
    required(
      environment,
      [
        'NAS_HOST',
        'NAS_PROTOCOL',
        'NAS_USER',
        'NAS_PASSWORD',
        'NAS_SMB_SHARE',
        'NAS_SMB_SUBFOLDER',
        'NAS_BASE_URL',
      ],
      errors,
    );
    port(environment, 'NAS_PORT', errors);
    if (!['http', 'https'].includes(environment.NAS_PROTOCOL ?? '')) {
      errors.push('NAS_PROTOCOL must be http or https');
    } else if (production && environment.NAS_PROTOCOL !== 'https') {
      errors.push('NAS_PROTOCOL must use HTTPS in production');
    }
    url(environment, 'NAS_BASE_URL', errors, production);
  }

  const smtpEnabled = enabled(environment, 'SMTP_ENABLED', false);
  if (smtpEnabled) {
    required(
      environment,
      ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
      errors,
    );
    port(environment, 'SMTP_PORT', errors);
    enabled(environment, 'SMTP_SECURE', false);
  }

  const swaggerEnabled = enabled(environment, 'SWAGGER_ENABLED', !production);
  if (production && swaggerEnabled)
    required(environment, ['SWAGGER_API_KEY'], errors);
  enabled(environment, 'HEALTH_READINESS_PROTECTED', false);
  if (enabled(environment, 'HEALTH_READINESS_PROTECTED', false)) {
    required(environment, ['HEALTH_READINESS_TOKEN'], errors);
  }

  const converterEnabled = enabled(
    environment,
    'DOCUMENT_CONVERTER_ENABLED',
    true,
  );
  if (
    converterEnabled &&
    environment.WASM_PATH !== undefined &&
    !environment.WASM_PATH.trim()
  ) {
    errors.push('WASM_PATH must not be empty when provided');
  }
  if (
    environment.LIBREOFFICE_PATH !== undefined &&
    !environment.LIBREOFFICE_PATH.trim()
  ) {
    errors.push('LIBREOFFICE_PATH must not be empty when provided');
  }

  required(environment, ['ERROR_LOG_STORAGE_PATH'], production ? errors : []);
  const retention =
    environment.ERROR_LOG_RETENTION ?? environment.ERROR_LOGS_RETENTION;
  if (retention && !/^\d+[dhm]$/.test(retention))
    errors.push('ERROR_LOG_RETENTION must be a duration such as 14d');
  const maxSize =
    environment.ERROR_LOG_MAX_SIZE ?? environment.ERROR_LOGS_MAX_SIZE;
  if (maxSize && !/^\d+[kmg]$/i.test(maxSize))
    errors.push('ERROR_LOG_MAX_SIZE must be a size such as 20m');

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration: ${[...new Set(errors)].join('; ')}`,
    );
  }
  return environment;
}
