---
name: ansei-quality
description: Complete any ANSEI implementation, bug fix, refactor, lint cleanup, or review with scoped validation and an exact evidence report. Use before finishing every code change.
---

# ANSEI quality gate

## Scope

1. Re-read the request and inspect `git status` before and after work.
2. Review the complete diff; preserve unrelated files and generated/build outputs.
3. Confirm all applicable ANSEI skills and nearest local conventions were followed.
4. Ensure no behavior was changed by formatting or lint-only cleanup.

## Code checks

- No new dead imports, unsafe `any`, ignored promises, debug logging, secrets, generated-file edits, or undocumented contract assumptions.
- Frontend API flow, reducer registration, auth, permissions, Ant Design compatibility, loading/error handling, and accessibility remain coherent.
- Backend validation, authorization, Swagger, transaction boundaries, audit logs, inventory ledger, and tests remain coherent.
- New source filenames, casing, placement, and required local watermark conventions match neighboring code.

## Validation matrix

- Web source: `pnpm lint:web`; add `pnpm build:web` for routes, auth, shared state/types/config, or broad changes.
- API source: focused Jest tests, `pnpm lint:api`, and `pnpm build:api`.
- Prisma: `pnpm prisma:validate`; generate only when required.
- Cross-app/release-ready work: root `pnpm lint`, `pnpm test -- --runInBand`, and `pnpm build` when feasible.
- Instruction/skill-only work: validate YAML frontmatter, unique skill names, referenced paths, `git diff --check`, and final status.

Broad formatter or fixer commands may rewrite imported debt. Use them only when cleanup is requested, inspect every changed file, and separate formatter-only changes from semantic fixes.

## Report

List exact commands, exit codes/results, changed files, pre-existing failures, skipped checks, and environment blockers. Never claim database, Redis, SSO, email, LibreOffice, printer, or external-system validation unless it ran.
