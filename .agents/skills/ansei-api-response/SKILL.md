---
name: ansei-api-response
description: Define, preserve, or migrate ANSEI HTTP API success, error, validation, pagination, download, redirect, and Swagger response contracts. Use for controller, DTO response, exception-filter, interceptor, or frontend-facing API-contract changes.
---

# ANSEI API response contract

## Current implementation is authoritative

ANSEI does **not** currently register a global success-response interceptor. Controllers therefore return their service payloads directly. The active global error filters are registered in `apps/api/src/main.ts`:

- `AllExceptionsFilter` is the general JSON error handler.
- `PrismaClientExceptionFilter` maps known Prisma request errors.

Do not introduce a success envelope, add an interceptor, alter an existing payload shape, or claim every API surface is envelope-compliant unless the request explicitly includes a contract migration. First inspect the target controller, service, DTOs, Swagger metadata, filters, frontend Redux consumers, and relevant tests.

## Existing error envelope baseline

JSON failures produced by the active filters use this baseline shape:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Request validation failed",
  "timestamp": "2026-08-20T10:00:00.000Z",
  "path": "/v1/warehouse/incoming"
}
```

Known Prisma mappings may additionally provide `error` and safe `details`. When maintaining those handlers:

- Preserve HTTP status semantics; never use HTTP 200 for an error.
- Keep `success: false`, `statusCode`, `message`, `timestamp`, and request `path` consistent where the active handler provides them.
- Keep error messages and details safe. Never send Prisma internals, SQL, stack traces, credentials, access tokens, full inventory payloads, or supplier-sensitive data.
- Do not use `any` for newly modified error parsing. Narrow `unknown` or define a safe response interface.
- Avoid competing global filters: inspect registration order in `main.ts` before changing filters.

## Status rules

- `200 OK`: successful read, update, or delete with a body.
- `201 Created`: successful creation.
- `202 Accepted`: asynchronous work accepted; return a safe reference/state, never claim it is complete.
- `204 No Content`: no response body or JSON wrapper.
- `400 Bad Request`: malformed input or intended business validation.
- `401 Unauthorized`: missing or invalid credentials.
- `403 Forbidden`: authenticated caller lacks permission.
- `404 Not Found`: record/resource absent.
- `409 Conflict`: unique constraint, prohibited state transition, or concurrency conflict.
- `500 Internal Server Error`: generic public response; log diagnostics safely.

Use `422` only if the target module already distinguishes it intentionally.

## Controller, service, and Swagger rules

1. Controllers own transport status, decorators, Swagger descriptions, and the unmodified service return value.
2. Services return domain DTO/data or throw Nest HTTP exceptions; they must not return `{ success: false }` as a normal result.
3. Match controller `@ApiResponse` metadata to the actual current payload. Do not document a future envelope as if it is implemented.
4. Use explicit DTOs for documented response structures, including list/pagination metadata when the module has it.
5. Preserve exact field casing, nullability, content type, API version, and status expected by existing web slices.
6. Keep binary downloads, streams, redirects/SSO callbacks, and no-content responses unwrapped.

## Controlled success-envelope migration

Only perform this workflow when explicitly requested:

1. Inventory actual controller payloads and all frontend/API consumers.
2. Design typed success, pagination, and error contracts compatible with existing consumers or coordinate a versioned breaking change.
3. Implement and register exactly one global interceptor and one coherent exception strategy.
4. Explicitly bypass files, streams, redirects, and `204` responses.
5. Update Swagger, Redux transport types, and regression tests in a controlled vertical slice.
6. Migrate remaining endpoints in batches; do not mix wrapped and double-wrapped payloads.

## Verification

Test the target success result, falsy payloads (`false`, `0`, empty string), `null`, lists/pagination where applicable, created/no-content statuses, validation errors, Prisma mappings, 500 sanitization, and special-response bypasses. Run focused API tests, `pnpm lint:api`, and `pnpm build:api`; run web checks too whenever consumer types or response shapes change.
