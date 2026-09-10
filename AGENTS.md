# ANSEI Monorepo

ANSEI is an inventory, manufacturing execution, and warehouse management system organized as a pnpm workspace:

- `apps/web/` (`@ansei/web`): Next.js 16 App Router frontend with React 19, Ant Design 6, Tailwind CSS 4, Redux Toolkit, and NextAuth 4.
- `apps/api/` (`@ansei/api`): NestJS 11 API with Prisma 7 and PostgreSQL.

## Instruction precedence

Read this file before changing the repository. Also inspect the nearest existing implementation and any applicable skill under `.agents/skills/`. Executable code, tests, package scripts, and `apps/api/prisma/schema.prisma` override descriptive documentation when they disagree. Preserve established behavior unless the request explicitly changes it.

## Workspace rules

- Work from the repository root with pnpm 10; keep the single root lockfile authoritative.
- Use filters for application commands: `pnpm --filter @ansei/web ...` and `pnpm --filter @ansei/api ...`.
- Keep web and API domain ownership separate. Coordinate contracts rather than importing application source across boundaries.
- Preserve unrelated changes. Never commit, amend, push, migrate a database, reset data, or expose secrets unless explicitly requested.
- Do not edit generated output in `apps/api/src/generated/prisma`, build output in `dist` or `.next`, dependencies in `node_modules`, or lockfiles except for intentional dependency changes.
- Do not invent routes, DTO fields, enum values, model relations, permissions, inventory formulas, statuses, or response shapes. Search source and schema first.
- Never log or expose passwords, tokens, API keys, employee identity, production-sensitive data, supplier-sensitive data, or full operational payloads.

## Architecture contracts

### Web

- Product routes live under `apps/web/app/apps`; route-specific components belong in the nearest `_components` directory and reusable components in `apps/web/components`.
- Business API calls must flow through typed Redux thunks in `store/features` and the established authenticated utility in `store/utils`; pages and components must not fetch business APIs directly.
- Register reducers in `store/index.ts`. Preserve centralized authentication, refresh, redirect, and permission behavior.
- Match backend methods, paths, versions, casing, query parameters, content types, and envelopes exactly.
- Follow neighboring Ant Design patterns, use stable row keys, centered dialogs, explicit loading/error states, and supported Ant Design 6 APIs.

### API

- Preserve NestJS module -> controller -> DTO -> service boundaries. Controllers handle transport; services own business rules and persistence.
- Validate requests with class-validator and use exact generated Prisma types. Keep authorization and Swagger metadata consistent with neighboring controllers.
- `apps/api/prisma/schema.prisma` is the persistence source of truth. Do not modify it without an explicit schema request; never hand-edit generated Prisma files.
- Use transactions for coupled writes. Keep external email, document, and queue side effects outside transactions where practical.
- Every database write must follow the existing `LogProcess`/`LogProcessDetail` audit convention and actor attribution.
- `InventoryLedger` is the stock source of truth; quantity fields on material and finish-good records are caches. Every stock mutation must create a ledger entry and preserve `BalanceAfter = BalanceBefore + QtyIn - QtyOut`.

## Skills

Read every skill applicable to the scope:

- `.agents/skills/ansei-web-feature/SKILL.md`: Next.js pages, components, Redux, API integration, and navigation.
- `.agents/skills/ansei-web-components/SKILL.md`: route component placement, typed React UI, forms, modals, and feedback.
- `.agents/skills/ansei-web-antd/SKILL.md`: installed Ant Design 6 APIs, tables, forms, modals, and deprecation prevention.
- `.agents/skills/ansei-web-redux-api/SKILL.md`: Redux thunks, authenticated API transport, query state, uploads/downloads, and errors.
- `.agents/skills/ansei-api-feature/SKILL.md`: NestJS controllers, DTOs, services, modules, permissions, logging, and tests.
- `.agents/skills/ansei-api-response/SKILL.md`: current API success/error contracts, response migration, Swagger, filters, and special transports.
- `.agents/skills/ansei-prisma/SKILL.md`: schema evidence, Prisma queries, transactions, generation, and migrations.
- `.agents/skills/ansei-inventory/SKILL.md`: inventory ledger, stock cache, warehouse, production, and Poka-Yoke invariants.
- `.agents/skills/ansei-security/SKILL.md`: authentication, authorization, secrets, and sensitive-data review.
- `.agents/skills/ansei-quality/SKILL.md`: lint, test, build, diff, and completion workflow.

For cross-application work, use both application skills plus database, security, domain, and quality skills as applicable.

## Commands

```bash
pnpm dev:web
pnpm dev:api
pnpm lint:web
pnpm lint:api
pnpm test:api -- --runInBand
pnpm test:e2e:api
pnpm build:web
pnpm build:api
pnpm prisma:validate
pnpm prisma:generate
```

The API `format` script writes all source and test TypeScript. Run it only when broad formatting is intended, then inspect the complete diff. Prefer targeted ESLint/Prettier commands for focused changes.

## Implementation workflow

1. Check `git status` and preserve existing work.
2. Read the applicable skills, nearest complete implementation, related types/tests, and exact API/schema contracts.
3. Trace callers and downstream stock, audit, auth, queue, document, and cache effects.
4. Make the smallest coherent change without unrelated refactoring.
5. Add focused tests for changed behavior and failure paths when practical.
6. Run proportional lint, tests, build/type validation, Prisma validation when relevant, and `git diff --check`.
7. Report exact commands and outcomes. Distinguish pre-existing failures and environment blockers from regressions.

Only claim database, Redis, SSO, email, file conversion, printer, or other integration verification when that infrastructure was actually exercised.
