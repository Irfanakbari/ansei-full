# Extreme Inventory E2E

Manual NestJS E2E tests for concurrent stock and production mutations. These
tests are intentionally excluded from the normal E2E configuration and CI.

## Safety prerequisites

- `DATABASE_URL` must point to a disposable PostgreSQL database on
  `localhost`, using the current `public` schema.
- The database name must end in `_test` or `_e2e`.
- The runner sets `NODE_ENV=test`, applies existing migrations, and truncates
  every application table in `public` except `_prisma_migrations`.
- Never point this command at development, staging, or production data.

Example database name: `ansei_extreme_test`.

## Commands

```bash
pnpm --filter @ansei/api test:e2e:extreme
pnpm --filter @ansei/api test:e2e:extreme:soak
```

The core suite runs the complete API journey and deterministic race/failure
scenarios. The soak suite defaults to 50 workers for 30 minutes. Override its
manual workload when required:

```bash
EXTREME_SOAK_WORKERS=20 EXTREME_SOAK_MINUTES=5 EXTREME_SOAK_SEED=investigation-42 pnpm --filter @ansei/api test:e2e:extreme:soak
```

PowerShell:

```powershell
$env:EXTREME_SOAK_WORKERS = '20'
$env:EXTREME_SOAK_MINUTES = '5'
$env:EXTREME_SOAK_SEED = 'investigation-42'
pnpm --filter @ansei/api test:e2e:extreme:soak
```

The database is cleared at the beginning, not at the end, so the last run can
be inspected after a failure. PostgreSQL trigger failpoints are removed in
`afterEach` even when an assertion fails. The soak seed is printed and its
request identities are deterministic, so a failed worker/operation can be
replayed without exposing credentials. Exhausted serializable retries are
reported as contention counters (`serializationConflicts`); the soak continues
and still requires every committed command, cache update, and ledger mutation
to reconcile exactly.
