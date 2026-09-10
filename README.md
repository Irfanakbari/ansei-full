# ANSEI Monorepo

## Applications

- `apps/web`: Next.js frontend
- `apps/api`: NestJS API

## Commands

```bash
pnpm install
pnpm dev:web
pnpm dev:api
pnpm lint
pnpm test
pnpm build
```

Copy `apps/api/.env.example` to `apps/api/.env` for local API configuration. Frontend public variables are supplied as environment variables or Docker build arguments.

## Validation

```bash
pnpm install --frozen-lockfile
pnpm prisma:validate
pnpm prisma:generate
pnpm lint:web
pnpm lint:api
pnpm test --runInBand
pnpm build:web
pnpm build:api
```

The frontend uses `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SSO_URL`, and `NEXT_PUBLIC_CALLBACK_AUTH_URL` at build time. These values are public and must not contain credentials. The API requires PostgreSQL and Redis at runtime; database migrations must be run explicitly with `prisma migrate deploy` before deployment and are not run when the container starts.

Build image from the repository root:

```bash
docker build --file Dockerfile -t ansei-single-app:local .
```
