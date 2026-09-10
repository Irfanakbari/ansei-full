---
name: ansei-web-redux-api
description: Use when adding or changing ANSEI web API calls, Redux Toolkit slices, thunks, query parameters, uploads, downloads, pagination, authentication-aware fetch handling, or backend error handling.
---

# ANSEI web API and Redux

## Establish the real contract first

1. Inspect the backend controller, DTOs, Swagger metadata, existing feature slice, and consumers before writing client code.
2. Match HTTP method, `/v1` versioning, route, parameter names, body fields, casing, requiredness, enums, response shape, and content type exactly.
3. Preserve backend field names in transport types. Create an explicit view model only when presentation requirements differ.
4. Do not assume a global success envelope exists: current ANSEI controllers generally return raw service data, while active error filters provide an error envelope. Follow the target endpoint’s implemented contract.

## Required request flow

```text
Page/component -> typed Redux thunk -> fetchWithAuth / approved shared utility -> API
Page/component <- typed selector/state <- slice reducers <------------------ response
```

- Put business requests in typed thunks under `store/features`; never make direct business `fetch` calls from product pages/components.
- Use `store/utils/fetchWithAuth.ts` for authenticated browser requests unless an established infrastructure exception applies.
- Do not duplicate bearer-token attachment, cookie credentials, 401 redirect/session cleanup, or API-base URL logic in each feature.
- Register every new slice reducer in `store/index.ts`.

## State, queries, and errors

- Type thunk args, fulfilled results, reject values, state, selectors, API DTOs, and pagination metadata.
- Model loading/error state granularly enough to avoid concurrent operation collisions and stale UI.
- Carry only API-supported filters, page, limit, sort, and search values into requests; omit empty values unless the endpoint defines their meaning.
- Catch `unknown`, extract a safe API message, and return it through `rejectWithValue`.
- Components must call mutation thunks with `.unwrap()`, show the server message safely, and update/refetch all affected state after success.
- Do not store non-serializable browser objects in Redux unless an existing feature establishes a safe pattern.

## Uploads, downloads, and authentication

- Match multipart field names and restrictions exactly; do not set the multipart boundary manually.
- Use blob handling for downloads and revoke object URLs.
- Do not log tokens, cookies, authorization headers, user identity, or inventory/production payloads.
- Preserve existing 401 behavior in `fetchWithAuth`; do not create competing logout loops.

## Verify

Recheck the final request URL, method, version, parameters, body, success shape, and error handling against backend source/Swagger. Search changed UI for direct business fetches. Run the applicable web, API contract, security, and quality skills.
