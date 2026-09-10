# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IPCS (Icuk Production Control System) adalah aplikasi frontend enterprise untuk Inventory & Production Control System yang dikembangkan oleh PT Vuteq Indonesia. Aplikasi ini berfungsi sebagai antarmuka pengguna yang menghubungkan dengan backend NestJS untuk mengelola data inventaris, produksi, dan kontrol sistem secara menyeluruh.

## Tech Stack

- **Framework**: Next.js 16 (App Router, React 19)
- **UI Library**: Ant Design 6 + Tailwind CSS v4
- **State Management**: Redux Toolkit with typed slices in `store/features/`
- **Authentication**: NextAuth v4 (Microsoft SSO) + custom token-based auth via localStorage
- **Package Manager**: pnpm (WAJIB digunakan untuk semua command npm/pnpm)

## Commands

```bash
pnpm dev         # Start development server (port 3000)
pnpm build       # Production build
pnpm start       # Start production server (port 3001)
pnpm lint        # Run ESLint
```

## Code Architecture

### API Layer (`app/api/`)

API Next.js berfungsi sebagai proxy ke API utama sistem IPS, jadi logic utamanya sebenarnya ada di backend (NestJS), API Next.js hanya sebatas mengumpulkan data dari front-end dan meneruskannya ke backend.

### Redux Store (`store/`)

- `store/index.ts` — root store combining all slice reducers
- `store/features/<domain>/` — one slice per feature domain (e.g., `master/`, `production/`, `master/material/`)
- `store/utils/fetchWithAuth.ts` — wraps fetch with automatic 401 handling (clears token, redirects to login)
- `store/provider.tsx` — Redux Provider wrapper used in layout

**ATURAN PENTING:**
- **WAJIB** gunakan Redux store untuk semua pemanggilan API
- **DILARANG** melakukan fetch API langsung dari komponen atau page
- Semua API call harus melalui thunk yang sudah ada di masing-masing domain slice
- Gunakan pattern: `createAsyncThunk('sliceName/actionName', async (args, { getState }) => {...})`

### Pages (`app/apps/`)

Pages under `/apps` are organized by feature domain:
- `master-data/` — Master data management (satuan, supplier, material, finish good, BOM, dll)
- `warehouse/` — Warehouse management (incoming, transfer, MRP, inventory counting)
- `production/` — Production management (forecast, release, shopping, delivery)
- `system-administration/` — System settings (roles, permissions, users, logs)
- Setiap folder adalah domain yang terpisah

### Shared Components (`components/`)

- `ToolbarWrapper` dan `ButtonToolbar` — consistent toolbar/card pattern used across pages
- Letakkan components yang sifatnya sangat umum di folder ini
- Component yang hanya digunakan di satu domain, letakkan di folder `_components` di dalam folder domain tersebut

### Private Components (_components)

- Folder `_components` digunakan untuk menyimpan komponen yang hanya digunakan di satu domain
- Letakkan folder `_components` DI DALAM folder domain tersebut
- **DILARANG** meletakkan folder `_components` di root directory
- Gunakan prinsip: tiap modal/component punya file-file pendukung seperti logic (slice), type, dan komponen itu sendiri dalam satu folder

## Aturan Penulisan Kode

### Struktur Folder per Domain
```
app/apps/<domain>/
├── _components/           # Komponen khusus domain ini saja
│   ├── MyComponent.tsx
│   └── MyModal.tsx
├── page.tsx               # Halaman utama
├── _components/          # (jika ada)
└── types.ts               # Type definitions untuk domain ini
```

### Redux Slice Pattern
```typescript
// store/features/<domain>/<domain>Slice.ts
import { createAsyncThunk } from '@reduxjs/toolkit';
import { fetchWithAuth } from '@/store/utils/fetchWithAuth';

export const fetchData = createAsyncThunk(
  'domain/fetchData',
  async (params: any, { getState, rejectWithValue }) => {
    try {
      const response = await fetchWithAuth('/api/endpoint', {
        method: 'GET',
      });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);
```

### Menu Navigation
Semua list menu ada di `app/apps/layout.tsx`. Pastikan jika ada permintaan page baru, menu dimasukkan di file tersebut.

## Modal Convention

- Semua modal **WAJIB** menggunakan `centered={true}`
- Contoh:
```tsx
<Modal
  centered={true}
  open={visible}
  onCancel={onClose}
  title="Judul Modal"
>
  {/* content */}
</Modal>
```

## Code Styling

- Selalu gunakan TypeScript untuk type definition
- Selalu gunakan ESLint untuk code styling
- Selalu gunakan Prettier untuk code formatting
- Selalu gunakan komentar untuk menjelaskan logic yang kompleks (singkat, padat, dan jelas)
- Beri watermark di setiap file yang dibuat dengan format:
  ```
  /* By Irfan Akbari Vuteq Indonesia - YYYY-MM-DD */
  ```

## Auth Flow

- SSO login via Microsoft redirects to `/auth/sso-success`
- Token stored in `localStorage` under key `token`
- `fetchWithAuth` intercepts 401 responses and redirects to `/`
- Auth slice in `store/features/auth/authSlice.ts` holds user session data

## Backend URL Resolution (`lib/config.ts`)

- Client-side: resolves to `window.location.protocol + '//' + window.location.hostname + ':43000'`
- Server-side: uses `Host` header to determine hostname, defaults to port 43000
- All API calls go to `<host>:43000/v1/<path>`

## Versioning

Setiap perubahan sesuaikan versioning di `app/page.tsx`:
- **Patch** (1): Bug fix, perubahan kecil
- **Minor** (2): Fitur baru yang backward compatible
- **Major** (3): Breaking changes
