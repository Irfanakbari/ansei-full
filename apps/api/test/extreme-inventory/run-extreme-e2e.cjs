/* By Irfan Akbari Vuteq Indonesia - 2026-09-24 */
require('dotenv/config');
const { spawnSync } = require('node:child_process');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

function fail(message) {
  process.stderr.write(`Extreme E2E refused: ${message}\n`);
  process.exit(1);
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) fail('DATABASE_URL is required.');

let databaseUrl;
try {
  databaseUrl = new URL(rawUrl);
} catch {
  fail('DATABASE_URL must be a valid PostgreSQL URL.');
}

if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
  fail('DATABASE_URL must use PostgreSQL.');
}
if (!['127.0.0.1', 'localhost', '::1'].includes(databaseUrl.hostname)) {
  fail('DATABASE_URL must target localhost.');
}
const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
if (!/(_test|_e2e)$/i.test(databaseName)) {
  fail('database name must end with _test or _e2e.');
}
const schema = databaseUrl.searchParams.get('schema');
if (schema && schema !== 'public') {
  fail('DATABASE_URL must use the current public schema.');
}

const mode = process.argv[2] === 'soak' ? 'soak' : 'core';
const environment = {
  ...process.env,
  NODE_OPTIONS:
    `${process.env.NODE_OPTIONS ?? ''} --experimental-vm-modules`.trim(),
  NODE_ENV: 'test',
  REDIS_REQUIRED: 'false',
  VUTEQ_SSO_ENABLED: 'false',
  NAS_ENABLED: 'false',
  SMTP_ENABLED: 'false',
  SWAGGER_ENABLED: 'false',
  DOCUMENT_CONVERTER_ENABLED: 'false',
  ERROR_LOG_STORAGE_PATH: join(tmpdir(), 'ansei-extreme-e2e-error-logs'),
  EXTREME_E2E_MODE: mode,
};

function runPnpm(args, stage) {
  const pnpmCli = process.env.npm_execpath;
  const command = pnpmCli ? process.execPath : 'pnpm';
  const commandArgs = pnpmCli ? [pnpmCli, ...args] : args;
  process.stdout.write(`Extreme E2E: ${stage}\n`);
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    env: environment,
    stdio: 'inherit',
  });
  if (result.error) {
    process.stderr.write(
      `Extreme E2E failed to launch ${stage}: ${result.error.message}\n`,
    );
    process.exit(1);
  }
  if (result.signal) {
    process.stderr.write(
      `Extreme E2E ${stage} terminated by signal ${result.signal}.\n`,
    );
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runPnpm(['exec', 'prisma', 'migrate', 'deploy'], 'applying migrations');

const pattern =
  mode === 'soak'
    ? 'test/extreme-inventory/inventory-production.soak.extreme-e2e-spec.ts'
    : 'test/extreme-inventory/inventory-production.extreme-e2e-spec.ts';
runPnpm(
  [
    'exec',
    'jest',
    '--config',
    './test/jest-extreme-e2e.json',
    '--runInBand',
    '--forceExit',
    pattern,
  ],
  `running ${mode} suite`,
);
