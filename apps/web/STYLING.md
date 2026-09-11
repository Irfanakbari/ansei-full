# ANSEI Web Styling

## Direction

ANSEI follows ESSA's compact enterprise UI conventions while retaining ANSEI purple for accents, primary actions, links, selected states, sidebar highlights, and existing logo assets.

## Typography

- Google font loading uses Inter through `next/font/google`.
- Base body and Ant Design typography use `Arial, Helvetica, sans-serif` to match ESSA rendering.
- Base text is `14px` with a `1.5` line height.
- Sidebar and toolbar text use `13px`.
- Tables use `12px`, with compact tables using `11px` cells.
- Heading scale: 32px, 28px, 22px, 18px, 16px, and 14px.

## Colors

### ANSEI accents

| Token | Value | Usage |
|---|---|---|
| Primary | `#4F46E5` | Primary buttons, links, selected states, sidebar highlights |
| Primary light | `#6366F1` | Hover and focus emphasis |
| Primary pale | `#EEF2FF` | Selected table rows and subtle highlights |
| Primary dark | `#3730A3` | Active and pressed states |

### ESSA-aligned neutrals

| Token | Value | Usage |
|---|---|---|
| Layout background | `#F7F7F5` | Application canvas |
| Surface | `#FCFCFA` | Content containers, cards, modals, drawers, popovers |
| Table header / hover | `#EDF2F6` | Table headers and hovered rows |
| Text | `#293241` | Primary text |
| Secondary text | `#66727D` | Supporting content |
| Border | `#D9DDDF` | Controls and table separators |
| Secondary border | `#E6E8E8` | Subtle dividers |
| Chrome | `#263545` | Sidebar, header, and footer beneath the batik treatment |
| Submenu | `#304254` | Dark submenu surfaces |

## Radius and elevation

- Default radius: `4px`.
- Large surface radius: `6px`.
- Pills and avatars may remain fully rounded.
- Standard surface shadow: `0 6px 16px rgba(38, 53, 69, 0.08)`.
- Elevated overlays: `0 8px 20px rgba(38, 53, 69, 0.1)`.

## Layout chrome

- Sidebar remains 300px expanded and 80px collapsed.
- Header and footer are sticky and use ESSA's dark chrome treatment with the existing ANSEI batik asset.
- Main content scrolls independently and uses a `#FCFCFA` surface with 20px padding and a 6px radius.
- Sidebar interaction states remain ANSEI purple.

## Tables

- Header background: `#EDF2F6`.
- Header and table text: `#293241`.
- Hover background: `#EDF2F6`.
- Selected background: `#EEF2FF` to preserve ANSEI branding.
- Default table text: `12px`; compact cells: `11px` with `6px 8px` padding.
- Table surfaces use a 6px radius and restrained shadow.

## Cards and overlays

Cards, modals, drawers, popovers, dropdowns, inputs, selects, and date pickers use the `#FCFCFA` surface and neutral ESSA border/elevation palette. Modal and drawer headers remain transparent with subtle separators.

## Loader

The existing loader structure and class names are preserved. It uses ESSA's blurred dark glass overlay and sizing, with purple spinner accents retained for ANSEI.

## Source files

- `app/globals.css`: variables, base styles, tables, surfaces, and sidebar states.
- `app/layout.tsx`: Inter loading and Ant Design theme tokens.
- `app/apps/layout.tsx`: application chrome and content surface layout.
- `app/batik.css`: batik chrome and glass loader treatment.
