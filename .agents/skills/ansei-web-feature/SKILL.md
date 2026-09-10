---
name: ansei-web-feature
description: Implement or review ANSEI Next.js frontend routes, components, Redux state, API integration, tables, forms, modals, and navigation. Use for changes under apps/web.
---

# ANSEI web feature

## Workflow

1. Inspect the target route, nearest `_components`, related Redux slice, `store/index.ts`, API utility, navigation, and backend contract.
2. Confirm route ownership under `app/apps/<domain>` and place feature-only UI in that route's `_components`.
3. Define typed request, response, query, and UI state from the implemented API; never guess fields or enums.
4. Put business requests in typed Redux thunks using the established authenticated request utility. Preserve backend errors with `rejectWithValue` and handle thunk results with `.unwrap()`.
5. Register new reducers and use repository `RootState` and `AppDispatch` types.
6. Follow neighboring Ant Design 6 patterns for tables, forms, centered modals, feedback, pagination, and loading states.
7. Update `app/apps/layout.tsx` only when navigation is required; preserve permission filtering.
8. Run the quality skill.

## Boundaries

- Do not fetch business APIs directly from pages/components.
- Keep auth/proxy infrastructure exceptions in their existing infrastructure folders.
- Do not store credentials or tokens in new browser-visible state or logs.
- Use server pagination/filtering/sorting when the API supports it; preserve query state on reload.
- Follow local naming and watermark conventions for newly created source files after verifying neighboring files.
- Do not bump application versions unless explicitly requested or required by established release policy.

## Verification

Run `pnpm lint:web`. Run `pnpm build:web` for routes, auth, shared store/types, config, or release-ready changes. Report environmental API/SSO limitations separately.
