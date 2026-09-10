---
name: ansei-security
description: Review or change ANSEI authentication, authorization, SSO, JWT/API keys, cookies, proxying, permissions, uploads, exports, and sensitive operational data. Use for all security-relevant work.
---

# ANSEI security

## Workflow

1. Trace the actual frontend session/proxy flow and backend guards, strategies, decorators, permissions, and current-user contract.
2. Confirm trust boundaries, credential storage, token transport, expiry/refresh behavior, and logout cleanup before editing.
3. Reuse exact permission identifiers and guard composition from implemented neighboring endpoints.
4. Validate all external input through DTOs, pipes, file constraints, and safe path/content handling.
5. Ensure exports and errors enforce the same authorization and data minimization as normal reads.
6. Review logs, responses, Redux/session state, URLs, cookies, and artifacts for secret or sensitive-data exposure.

## Rules

- Never log passwords, JWTs, refresh tokens, raw API keys, session IDs, or full sensitive payloads.
- Do not expose backend credentials to client JavaScript or public environment variables.
- Use `@Public()` only with explicit evidence that unauthenticated access is intended.
- Preserve centralized 401/refresh behavior; avoid retry loops and duplicate refreshes.
- Do not weaken authorization, validation, TLS assumptions, or cookie controls to make local development easier.
- Treat uploads, generated documents, spreadsheets, printer paths, and email attachments as untrusted or sensitive boundaries.

## Verification

Test unauthenticated, unauthorized, authorized, expired-session, malformed-input, and sensitive-error paths when applicable. Clearly state which identity provider and integration paths were not exercised.
