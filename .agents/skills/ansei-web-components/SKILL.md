---
name: ansei-web-components
description: Build or review ANSEI Next.js pages, route components, forms, modals, toolbars, and interactive React UI under apps/web. Use with ansei-web-feature for feature work.
---

# ANSEI web components

## Inspect before implementation

Read the owning `page.tsx`, nearest comparable `_components`, the connected Redux slice/thunks, shared components, and backend contract. Confirm installed Ant Design 6 APIs from local typings or existing current usage before adding properties.

## Placement and ownership

- Keep `page.tsx` as the route entry/orchestration layer: typed selectors, thunk dispatch, page state, and composition.
- Put route-only components in the closest owning `app/apps/<domain>/**/_components/` directory.
- Let tables own columns, formatting, selection, and table events. Let forms/modals own local form state and validation.
- Promote code to `apps/web/components/` only after genuine cross-route reuse exists.
- Use `"use client"` only for hooks, browser APIs, Redux access, or interactive state.
- Follow the repository watermark convention for every new TypeScript file after confirming the local file style.

## UI and type requirements

- Type props, form values, callbacks, records, selectors, and thunk results. Do not add `any` if API DTOs, existing project types, or Ant Design types can represent the value.
- Keep user-visible labels, validation, notifications, tooltips, and empty states consistent with nearby UI and English where creating new copy.
- Reuse existing toolbar/button patterns when appropriate instead of creating parallel primitives.
- Keep backend business calls out of pages/components: dispatch typed Redux thunks and use `.unwrap()` for mutations.

## Forms, modals, feedback

- Center every modal and confirmation dialog.
- Use current Ant Design 6 properties; do not introduce deprecated aliases.
- Use contextual Ant Design feedback through the existing app/provider pattern.
- Disable duplicate submissions, show pending state, and only close/reset a form after success.
- Reset fields/local state deliberately when the target record changes or the dialog closes.
- When using `Form.useForm()` with an initially closed Ant Design `Modal`, pass `forceRender` to the Modal so the form is connected before any `setFieldsValue`, `setFieldValue`, `validateFields`, or `resetFields` call. If forms live in inactive `Tabs`, set `forceRender: true` on each tab containing a referenced form. Never suppress the "Instance created by useForm is not connected" warning; fix the mount lifecycle.
- Preserve backend rejection messages; provide an English fallback only when no safe meaningful message exists.

## Verify

Check loading, empty, error, success, cancellation, and repeated-submit behavior. Run `pnpm lint:web`; run `pnpm build:web` for route, shared-component, store/type, auth, or release-ready changes.
