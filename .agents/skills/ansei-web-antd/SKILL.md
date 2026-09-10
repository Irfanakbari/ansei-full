---
name: ansei-web-antd
description: Use when adding, changing, or reviewing Ant Design components, props, forms, tables, modals, layouts, feedback, or deprecation warnings in apps/web. Enforces the installed Ant Design 6 APIs and typings.
---

# ANSEI Ant Design 6

## Installed API is the source of truth

- Verify the installed Ant Design 6 package, TypeScript declarations, and nearby current usage before changing a component prop.
- Do not copy Ant Design 4/5 snippets without verifying they remain supported.
- Resolve every deprecation warning introduced by the work; do not suppress warnings.

## Current property rules

- Use `Modal` `open`, not legacy `visible`.
- Prefer `Space` `orientation`, not legacy `direction`.
- Prefer supported `styles` APIs rather than deprecated style props such as `bodyStyle` or `maskStyle`.
- Use `destroyOnHidden` where the installed component supports it, not deprecated destruction props.
- Use current `Spin`, dropdown, popup, tooltip, select, table, pagination, and form properties confirmed by typings.

## Forms and feedback

- Use the existing contextual message/notification/modal mechanism below the Ant Design provider.
- Center modal and confirmation dialogs.
- Use `Form` validation for correctable input, represent pending state, and prevent duplicate submissions.
- Reset controlled form fields and state deliberately after close or target changes.

## Tables and data UI

- Use `TableProps<RecordType>` and a stable domain identifier for `rowKey`; never use an array index when a stable key exists.
- Bind loading and error UI to the relevant Redux request state.
- Ensure `dataSource` is an array before rendering; normalize API response shapes in slices/thunks rather than presentation components.
- Use API-provided pagination/filter/sort parameters and metadata where the contract supports them.
- Make empty values, selection preconditions, responsive scroll, and destructive actions intentional.

## Verify

Search changed TSX files for legacy/deprecated props and confirm them against local typings. Exercise loading, empty, validation, mutation failure, and modal close/reopen paths. Run `pnpm lint:web` and `pnpm build:web` when the scope warrants it.
