# STYLING.md - IPS-FE Design System Documentation

## Overview
Dokumentasi sistem styling untuk IPS-FE (Inventory Production Control System). Menggunakan tema original dengan font Plus Jakarta Sans yang lebih modern dan readable.

## Color Palette

### Primary Colors (Indigo)
| Name | Hex Code | Usage |
|------|----------|-------|
| Primary | `#4F46E5` | Main buttons, primary actions, links |
| Primary Light | `#6366F1` | Hover states, secondary emphasis |
| Primary Pale | `#EEF2FF` | Backgrounds, badges, highlights |
| Primary Dark | `#3730A3` | Active states, pressed buttons |

### Secondary Colors (Violet)
| Name | Hex Code | Usage |
|------|----------|-------|
| Secondary | `#7C3AED` | Secondary actions |
| Secondary Light | `#8B5CF6` | Violet highlights |
| Secondary Pale | `#F5F3FF` | Secondary backgrounds |

### Accent Colors (Pink)
| Name | Hex Code | Usage |
|------|----------|-------|
| Accent | `#EC4899` | Accent highlights |
| Accent Light | `#F472B6` | Soft pink highlights |
| Accent Pale | `#FDF2F8` | Pink backgrounds |

### Neutral Colors
| Name | Hex Code | Usage |
|------|----------|-------|
| Background | `#FFFFFF` | Page backgrounds |
| Surface | `#FFFFFF` | Cards, panels |
| Border | `#E5E7EB` | Borders, dividers |
| Text Primary | `#111827` | Main text |
| Text Secondary | `#6B7280` | Secondary text |
| Text Tertiary | `#9CA3AF` | Placeholder text |

### Semantic Colors
| Name | Hex Code | Usage |
|------|----------|-------|
| Success | `#10B981` | Success messages |
| Success Pale | `#D1FAE5` | Success backgrounds |
| Warning | `#F59E0B` | Warning messages |
| Warning Pale | `#FEF3C7` | Warning backgrounds |
| Error | `#EF4444` | Error messages |
| Error Pale | `#FEE2E2` | Error backgrounds |
| Info | `#3B82F6` | Information messages |
| Info Pale | `#DBEAFE` | Information backgrounds |

## Typography

### Font Families
```css
/* Primary Font - Plus Jakarta Sans (Improved readability) */
font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Secondary Font - Inter */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Monospace Font - JetBrains Mono */
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Font Sizes (Improved for better readability)
| Name | Size | CSS Variable | Usage |
|------|------|--------------|-------|
| xs | 12px | `--text-xs` | Labels, badges |
| sm | 14px | `--text-sm` | Secondary text, menu items |
| base | 15px | `--text-base` | Body text |
| lg | 17px | `--text-lg` | Large body text |
| xl | 20px | `--text-xl` | Subtitles |
| 2xl | 24px | `--text-2xl` | Titles |
| 3xl | 30px | `--text-3xl` | Headings |
| 4xl | 36px | `--text-4xl` | Page titles |

### Component Font Sizes
| Component | Size | CSS Variable |
|-----------|------|-------------|
| Sidebar Menu | 14px | `--sidebar-font-size` |
| Sidebar Icon | 18px | `--sidebar-icon-size` |
| Toolbar | 14px | `--toolbar-font-size` |
| Table Header | 13px | `--table-header-font-size` |
| Table Cell | 13px | `--table-cell-font-size` |

## Ant Design Theme Configuration

```typescript
const themeConfig = {
  token: {
    colorPrimary: '#4F46E5',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#3B82F6',
    borderRadius: 8,
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: 15,
  },
  components: {
    Table: {
      cellPaddingBlock: 10,
      rowSelectedBg: '#F2ECFF',
      rowHoverBg: '#EEF2FF',
      fontSize: 13,
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: 'rgba(99, 102, 241, 0.3)',
      fontSize: 14,
    },
    Button: {
      primaryShadow: '0 2px 4px rgba(79, 70, 229, 0.3)',
    },
  },
};
```

## Spacing System
Based on 4px grid:
| Name | Size |
|------|------|
| 1 | 4px |
| 2 | 8px |
| 3 | 12px |
| 4 | 16px |
| 5 | 20px |
| 6 | 24px |
| 8 | 32px |
| 10 | 40px |
| 12 | 48px |

## Border Radius
| Name | Size | Usage |
|------|------|-------|
| sm | 4px | Badges, small elements |
| md | 8px | Default, buttons, inputs |
| lg | 12px | Cards, modals |
| xl | 16px | Large elements |
| full | 9999px | Avatars, pills |

## Shadows
| Name | Value |
|------|-------|
| sm | `0 1px 2px rgba(0,0,0,0.05)` |
| md | `0 4px 6px -1px rgba(0,0,0,0.1)` |
| lg | `0 10px 15px -3px rgba(0,0,0,0.1)` |
| xl | `0 20px 25px -5px rgba(0,0,0,0.1)` |

## Gradient Backgrounds
```
gradient-background: linear-gradient(56deg, #010031, #292751)
batik-bg: #0f172a with batik5.png pattern overlay
```

## Usage Guidelines

### Color Usage
1. **Indigo (#4F46E5)**: Primary buttons, links, selected states
2. **Violet (#7C3AED)**: Secondary actions
3. **Pink (#EC4899)**: Accent highlights
4. **White (#FFFFFF)**: Card backgrounds, content areas
5. **Slate (#0f172a)**: Sidebar, header, footer backgrounds

### Typography Guidelines
1. Use Plus Jakarta Sans for all UI elements
2. Base font size: 15px (increased for readability)
3. Line height: 1.6 for body text
4. Font weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### Sidebar Guidelines
1. Menu items: 44px height, 14px font
2. Icons: 18px size
3. Selected items: Indigo highlight
4. Collapsed width: 80px
5. Expanded width: 300px

### Table Guidelines
1. Header: 13px, font-weight 600, pale indigo background
2. Cells: 13px font size
3. Row hover: Light indigo
4. Row selected: Light purple (#F2ECFF)

## File Structure
```
app/
├── globals.css          # Base styles, CSS variables
├── batik.css           # Header/footer background
├── layout.tsx          # Ant Design theme config
├── page.tsx            # Login page
apps/
├── layout.tsx          # Sidebar, header, footer
```

## Version History
| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | 2026-06-18 | Added Plus Jakarta Sans font, improved typography sizes |
| 1.0.0 | 2026-06-07 | Original theme |

---

*Last updated: 2026-06-18*
