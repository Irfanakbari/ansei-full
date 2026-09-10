---
name: ansei-versioning
description: Bump the project and UI version whenever making feature changes, bug fixes, or breaking changes. Use this skill when modifying BE or FE code according to the semantic versioning policy.
---

# ANSEI Versioning

## Policy

Every code change must increment the application version across the workspace. Follow semantic versioning (`major.minor.patch`):
- **Patch** (+0.0.1): Bug fixes, minor adjustments, styling.
- **Minor** (+0.1.0): New features, backward-compatible additions.
- **Major** (+1.0.0): Breaking changes, major overhauls.

## Required Updates

When asked to bump the version, you must update ALL of the following locations:

1. `package.json` (Workspace root)
2. `apps/api/package.json` (API)
3. `apps/web/package.json` (Web)
4. `apps/web/app/page.tsx` (Login page footer)

## Workflow

1. Check the current version in `package.json` (root).
2. Determine the appropriate bump (e.g., `1.1.0` -> `1.1.1` for a patch).
3. Apply the exact same version string to all 4 files.
4. Verify the diff to ensure consistency.
