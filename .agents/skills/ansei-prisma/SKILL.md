---
name: ansei-prisma
description: Work safely with ANSEI Prisma 7 schema, generated client, PostgreSQL queries, transactions, seeds, and migrations. Use for database models, Prisma calls, persistence bugs, or schema work.
---

# ANSEI Prisma

## Evidence and workflow

1. Inspect `apps/api/prisma/schema.prisma`, `prisma.config.ts`, generated type exports, owning service, and tests.
2. Confirm exact field names, mapped names, IDs, nullability, defaults, relations, indexes, uniqueness, enums, and delete behavior.
3. Follow existing Prisma client injection and selector/include patterns; return only data required by the contract.
4. Use one transaction for writes that must be atomic and preserve audit and inventory invariants.
5. Consider concurrency for stock balances and uniqueness; do not implement read-modify-write without understanding transaction isolation.
6. For an explicitly authorized schema change, update schema and migration together, regenerate client, and update affected code/tests.

## Safety

- The schema is authoritative; generated files are disposable output and must never be edited.
- Do not run `migrate reset`, destructive SQL, seeds, or migrations against an unknown database.
- Do not change schema merely to accommodate an unverified frontend assumption.
- Keep credentials out of commands and reports.
- Treat generated-client diffs as intentional artifacts only when generation is requested.

## Verification

Run `pnpm prisma:validate`, relevant tests, `pnpm build:api`, and `pnpm lint:api`. Run generation only when schema/client synchronization requires it. Report whether a real database was contacted.
