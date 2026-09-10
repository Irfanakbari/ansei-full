---
name: ansei-api-feature
description: Implement or review ANSEI NestJS API features including modules, controllers, DTOs, services, permissions, Swagger, audit logs, jobs, and tests. Use for changes under apps/api/src or apps/api/test.
---

# ANSEI API feature

## Workflow

1. Read the nearest complete vertical slice: module, controller, DTOs, service, tests, relevant guards/decorators, and schema models.
2. Confirm exact route, method, version, permission, validation, response, and actor contract.
3. Keep controllers transport-only and place orchestration, persistence, and business rules in services.
4. Use class-validator DTOs, explicit types, and generated model/enum imports following local conventions.
5. Use a Prisma transaction for coupled writes; assess stock, audit, document, email, and queue side effects.
6. For every write, preserve the established `LogProcess` and `LogProcessDetail` lifecycle, actor, function ID, status, and error pattern.
7. Register only necessary module imports, controllers, providers, and exports.
8. Add focused service/controller tests with existing Jest mocking patterns.
9. Run Prisma, inventory, security, and quality skills when relevant.

## Boundaries

- Never edit `src/generated/prisma`.
- Never guess permission strings, schema fields, IDs, enum values, or logging identifiers.
- Use `@Public()` only for intentionally public endpoints and preserve existing JWT/API-key guard composition.
- Avoid `any` in new code; narrow `unknown` errors safely.
- Do not include secrets or sensitive operational payloads in audit or diagnostic logs.
- Do not emit irreversible external side effects before a transaction commits unless existing compensation behavior requires it.

## Verification

Start with focused Jest tests, then run `pnpm lint:api` and `pnpm build:api`. Run `pnpm prisma:validate` for schema/config/query-sensitive work and e2e only when its environment is available.
