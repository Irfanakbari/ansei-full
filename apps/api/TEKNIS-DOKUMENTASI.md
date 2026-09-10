# Dokumentasi Teknis API ANSEI Revamp

**Versi Dokumen:** 1.0.0  
**Tanggal:** 21 Juli 2026  
**Status:** Dokumen Aktif

---

## Daftar Isi

1. C. Dokumentasi Teknis
2. D. Source Code
3. E. Database
4. F. API & Integrasi
5. G. Infrastruktur
6. H. Deployment

---

# C. Dokumentasi Teknis

## C.1 Arsitektur Aplikasi

### C.1.1 Gambaran Arsitektur

Sistem API ANSEI Revamp menggunakan arsitektur Layered Architecture dengan pattern Modular Monolith yang dikembangkan menggunakan NestJS Framework.

Arsitektur sistem terdiri dari beberapa layer:

`
CLIENT LAYER
============
- Web Application (React)
- Mobile Application (Future)
- Third Party Systems
- IoT Devices (Label Scanner)

         |
         v

API GATEWAY / LOAD BALANCER
===========================
- Nginx (Future)
- Rate Limiting
- SSL Termination

         |
         v

APPLICATION LAYER
=================
NestJS API Server (Port 7500)

Modules:
- Auth Module (JWT + SSO)
- Master Data Module
- Production Module
- Warehouse Module
- Settings Module

         |
         v

DATA LAYER
==========
- PostgreSQL Database
- Redis (BullMQ Queue)
- NAS Storage (File Upload)

         |
         v

INFRASTRUCTURE LAYER
====================
- Docker Container
- Ubuntu Server
- Docker Compose
`

### C.1.2 Design Principles

Sistem ini dibangun dengan prinsip-prinsip berikut:

1. **Single Responsibility Principle (SRP)**
   - Controller: Hanya handle HTTP routing, request/response
   - Service: Semua business logic ada di sini
   - Module: Dependency injection definition

2. **Inventory Ledger Pattern**
   - InventoryLedger adalah SATU-SATUNYA source of truth untuk stok
   - Material.QtyRack, Material.QtyWarehouse adalah CACHE untuk UI saja
   - Setiap mutasi stok HARUS buat entry di ledger

3. **Audit Logging - LogProcess & LogProcessDetail**
   - SETIAP operasi/service yang melakukan write ke database HARUS mencatat log
   - Buat entry di LogProcess untuk setiap proses utama
   - Buat entry di LogProcessDetail untuk setiap sub-langkah

4. **Prinsip TPS (Toyota Production System)**
   - Sistem MES untuk lini produksi ANSEI
   - Poka-Yoke (Error Proofing) untuk validasi label



### C.1.3 Arsitektur Modular

`
src/
├── auth/                    # Authentication & Authorization
│   ├── strategies/          # JWT, Microsoft SSO, API Key
│   ├── guards/              # JwtAuthGuard, PermissionsGuard
│   ├── decorators/          # CurrentUser, Permission, Public
│   └── interfaces/          # ICurrentUser
│
├── master/                  # Master Data Modules
│   ├── satuan/              # Satuan (Unit)
│   ├── supplier/             # Supplier
│   ├── material/             # Material
│   ├── finish-good/          # Finish Good
│   ├── bill-of-materials/    # BOM
│   ├── box-qty/              # Box Quantity
│   └── man-power/            # Man Power
│
├── production/              # Production Modules
│   ├── delivery/             # Delivery
│   ├── forecast/             # Forecast
│   ├── pokayoke/            # Poka-Yoke (Label Validation)
│   ├── pre-delivery/         # Pre-Delivery
│   ├── production-release/   # Production Schedule
│   ├── production-report/    # Production Report
│   └── shopping/             # Material Shopping
│
├── warehouse/               # Warehouse Modules
│   ├── incoming/            # Incoming Material
│   └── transfer/             # Transfer
│
├── inventory-counting/      # Stock Opname
├── material-delivery-note/   # Surat Jalan Material
├── system-log/              # System Log Viewer
├── user-management/         # User Management
├── settings/                 # App Settings
├── mrp/                      # Material Requirement Planning
├── frontend/                 # Frontend Proxy
│
├── common/                  # Shared Utilities
│   ├── filters/             # Exception filters
│   ├── log-process/          # Audit logging
│   └── utils/               # Helpers, middleware
│
├── prisma/                  # Prisma Service
│   └── schema.prisma        # Database schema
│
└── generated/prisma/        # Auto-generated Prisma client



---

## C.2 Teknologi dan Framework

### C.2.1 Core Technologies

| Kategori | Teknologi | Versi | Keterangan |
|----------|----------|-------|------------|
| **Runtime** | Node.js | 22.x | JavaScript runtime |
| **Framework** | NestJS | 11.x | Progressive Node.js framework |
| **Language** | TypeScript | 5.x | Type-safe JavaScript |
| **ORM** | Prisma | 7.x | Next-generation Node.js ORM |
| **Database** | PostgreSQL | Latest | Primary data store |
| **Queue** | BullMQ | 11.x | Redis-based queue |
| **Cache** | Redis | Latest | Session & queue storage |
| **Container** | Docker | Latest | Application containerization |
| **Package Manager** | pnpm | 10.x | Fast, disk space efficient |

### C.2.2 Authentication & Security

| Teknologi | Versi | Keterangan |
|-----------|-------|------------|
| @nestjs/jwt | 11.x | JWT token generation |
| passport-jwt | 4.x | JWT passport strategy |
| passport-microsoft | 2.x | Microsoft SSO/Azure AD |
| bcrypt | 6.x | Password hashing |
| helmet | 8.x | Security headers |
| @nestjs/throttler | 6.x | Rate limiting |

### C.2.3 API Documentation

| Teknologi | Versi | Keterangan |
|-----------|-------|------------|
| @nestjs/swagger | 11.x | OpenAPI/Swagger documentation |

### C.2.4 Data Processing

| Teknologi | Versi | Keterangan |
|-----------|-------|------------|
| exceljs | 4.x | Excel file processing |
| xlsx | 0.18.x | Excel/CSV parsing |
| dayjs | 1.11.x | Date manipulation |
| multer | 2.x | File upload handling |

### C.2.5 Utilities

| Teknologi | Versi | Keterangan |
|-----------|-------|------------|
| class-validator | 0.15.x | DTO validation |
| class-transformer | 0.5.x | Object transformation |
| nodemailer | 9.x | Email sending |
| bwip-js | 4.x | Barcode generation |
| sharp | 0.35.x | Image processing |
| @matbee/libreoffice-converter | 2.6.x | Document conversion |



---

## C.3 Dependency/Library

### C.3.1 Production Dependencies

| Package | Version | Keterangan |
|---------|---------|------------|
| @nestjs/bullmq | 11.x | Redis queue |
| @nestjs/common | 11.x | Core framework |
| @nestjs/config | 4.x | Configuration |
| @nestjs/core | 11.x | Core module |
| @nestjs/jwt | 11.x | JWT auth |
| @nestjs/platform-express | 11.x | Express adapter |
| @nestjs/swagger | 11.x | API docs |
| @nestjs/throttler | 6.x | Rate limiting |
| @prisma/client | 7.x | Database ORM |
| bcrypt | 6.x | Password hashing |
| exceljs | 4.x | Excel processing |
| passport-jwt | 4.x | JWT strategy |
| passport-microsoft | 2.x | MS SSO |
| nodemailer | 9.x | Email sending |
| xlsx | 0.18.x | Spreadsheet |
| sharp | 0.35.x | Image processing |
| bwip-js | 4.x | Barcode |

### C.3.2 Dev Dependencies

| Package | Version |
|---------|---------|
| @nestjs/cli | 11.x |
| @nestjs/testing | 11.x |
| jest | 30.x |
| typescript | 5.x |
| prisma | 7.x |
| eslint | 9.x |
| prettier | 3.x |

### C.3.3 NPM Scripts

| Script | Keterangan |
|--------|------------|
| build | Build NestJS application |
| start | Start application |
| start:dev | Start with watch mode |
| start:prod | Start production build |
| lint | Run ESLint |
| test | Run unit tests |
| test:cov | Run tests with coverage |
| db:seed | Seed database |
| db:reset | Reset database |



---

## C.4 Struktur Source Code

### C.4.1 Direktori Utama

`
api-ansei-revamp/
├── .github/
│   └── workflows/          # CI/CD pipelines
│       └── ci-cd.yml       # GitHub Actions config
│
├── src/
│   ├── auth/               # Authentication module
│   ├── master/             # Master data modules
│   ├── production/         # Production modules
│   ├── warehouse/          # Warehouse modules
│   ├── common/             # Shared utilities
│   ├── generated/prisma/   # Auto-generated Prisma types
│   ├── prisma/             # Prisma service
│   ├── app.module.ts       # Root module
│   └── main.ts             # Entry point
│
├── prisma/
│   ├── migrations/         # Database migrations
│   ├── schema.prisma       # Database schema
│   └── seed.ts            # Database seeder
│
├── Dockerfile              # Docker image
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── nest-cli.json          # NestJS CLI config
├── .env.example           # Environment template
└── .env.production.example # Production env template
`

### C.4.2 Pattern per Module

Setiap module mengikuti struktur folder pattern:

`
module-name/
├── dto/
│   ├── create-module.dto.ts
│   ├── update-module.dto.ts
│   └── index.ts
│
├── entities/
│   ├── module.entity.ts
│   └── index.ts
│
├── module-name.controller.ts
├── module-name.controller.spec.ts
├── module-name.service.ts
├── module-name.service.spec.ts
└── module-name.module.ts
`

### C.4.3 Naming Conventions

| Type | Pattern | Contoh |
|------|---------|--------|
| Module | kebab-case | material.module.ts |
| Controller | kebab-case | material.controller.ts |
| Service | kebab-case | material.service.ts |
| DTO | kebab-case | create-material.dto.ts |
| Entity | kebab-case | material.entity.ts |
| Test | kebab-case | material.service.spec.ts |
| Class | PascalCase | MaterialService |
| Variable | camelCase | materialId |
| Constant | UPPER_SNAKE_CASE | MAX_RETRY |


---

# D. Source Code

## D.1 Repository Git

### D.1.1 Informasi Repository

| Property | Value |
|----------|-------|
| **Repository URL** | (Will be provided by team) |
| **Remote Name** | origin |
| **Default Branch** | main |
| **Working Branch** | staging |

### D.1.2 Git Configuration

`ash
# Clone repository
git clone repository-url
cd api-ansei-revamp

# Add remote
git remote add origin repository-url

# Verify remote
git remote -v
`

### D.1.3 Git Ignore

File dan direktori yang di-exclude dari Git:

`
# compiled output
/dist
/node_modules
/build

# environment files
.env
.env.local

# IDE
.idea
.vscode

# generated
/src/generated/prisma
`

---

## D.2 Branch Strategy

### D.2.1 Branch Model

Proyek ini menggunakan GitHub Flow dengan branch utama:

- **main** - Production-ready code
- **staging** - Integration branch for testing
- **feature/*** - Feature branches
- **hotfix/*** - Hotfix branches

### D.2.2 Branch Types

| Branch Type | Prefix | Contoh | Purpose |
|-------------|--------|--------|---------|
| Feature | feature/ | feature/add-pokayoke | New features |
| Bug Fix | fix/ | fix/login-redirect | Bug fixes |
| Hotfix | hotfix/ | hotfix/critical-security | Urgent fixes |

### D.2.3 Workflow

1. Create feature branch from staging
2. Make changes and commit
3. Push to remote
4. Create Pull Request to staging
5. After testing, merge staging to main

### D.2.4 Commit Message Convention

Format: type(scope): description

| Type | Keterangan |
|------|------------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation |
| refactor | Code refactoring |
| test | Adding tests |

---

## D.3 Release Notes

### D.3.1 Release Process

1. Create release branch from staging
2. Update version in package.json
3. Update CHANGELOG.md
4. Create GitHub Release
5. Tag commit
6. Merge to main

### D.3.2 Versioning

Format: MAJOR.MINOR.PATCH

| Component | Keterangan |
|-----------|------------|
| MAJOR | Breaking changes |
| MINOR | New features |
| PATCH | Bug fixes |

### D.3.3 Current Version

- **Package Version**: 0.0.1
- **Status**: Initial Development

---

## D.4 Change Log

Change log maintained in CHANGELOG.md dengan format Keep a Changelog.

GitHub Actions automatically generate release notes dari commit messages.


---

# E. Database

## E.1 ERD (Entity Relationship Diagram)

### E.1.1 Entity Overview

`
CORE ENTITIES:
==============
Satuan (1) ──── (N) Material
Supplier (1) ──── (N) Incoming ──── (N) IncomingMaterial ──── (N) Material

Material (1) ──── (N) InventoryLedger
FinishGood (1) ──── (N) InventoryLedger

Material (N) ──── (1) BillOfMaterials ──── (N) FinishGood (1)

FinishGood (1) ──── (N) Forecast ──── (1) ProductionRelease
FinishGood (1) ──── (N) ProductionReport
FinishGood (1) ──── (N) LabelData

AUTH ENTITIES:
==============
MTCRole (1) ──── (N) MTCUserManagement
MTCUserManagement (1) ──── (N) MTCUserSession
MTCUserManagement (1) ──── (N) MTCAuthLog
MTCUserManagement (1) ──── (N) ApiKey
`

### E.1.2 Relasi Utama

| Entitas 1 | Relasi | Entitas 2 | Tipe |
|-----------|--------|-----------|------|
| Material | 1:N | IncomingMaterial | FK |
| Material | 1:N | BillOfMaterials | FK |
| Material | 1:N | InventoryLedger | FK |
| FinishGood | 1:N | BillOfMaterials | FK |
| FinishGood | 1:N | Forecast | FK |
| FinishGood | 1:N | InventoryLedger | FK |
| Supplier | 1:N | Incoming | FK |
| MTCRole | 1:N | MTCUserManagement | FK |
| ProductionRelease | 1:N | Forecast | FK |

---

## E.2 Data Dictionary

### E.2.1 Enum Definitions

#### LocationType
| Value | Keterangan |
|-------|------------|
| WAREHOUSE | Gudang utama |
| RACK | Rak penyimpanan |
| FINISH_GOOD_AREA | Area barang jadi |

#### TransactionType
| Value | Keterangan |
|-------|------------|
| INCOMING_SUPPLIER | Barang masuk dari supplier |
| TRANSFER_TO_RACK | Transfer ke rak |
| PRODUCTION_USAGE | Penggunaan produksi |
| PRODUCTION_RESULT | Hasil produksi |
| DELIVERY_TO_CUSTOMER | Pengiriman ke customer |
| NG_SCRAP | Barang NG/discard |
| ADJUSTMENT_MANUAL | Penyesuaian manual |
| STOCK_OPNAME_DIFF | Selisih stock opname |
| MATERIAL_OUT_DELIVERY | Material keluar |

#### ItemCategory
| Value | Keterangan |
|-------|------------|
| MATERIAL | Material/bahan baku |
| FINISH_GOOD | Barang jadi |

#### OpnameStatus
| Value | Keterangan |
|-------|------------|
| DRAFT | Draft |
| IN_PROGRESS | Sedang berjalan |
| COMPLETED | Selesai |
| CANCELLED | Dibatalkan |

#### ProductionStatus
| Value | Keterangan |
|-------|------------|
| DRAFT | Draft |
| RELEASED | Dirilis |
| COMPLETED | Selesai |
| CANCELLED | Dibatalkan |

#### DeliveryNoteStatus
| Value | Keterangan |
|-------|------------|
| DRAFT | Draft |
| SHIPPED | Dalam perjalanan |
| RECEIVED | Diterima |
| CANCELLED | Dibatalkan |



---

## E.3 Struktur Tabel

### E.3.1 Tabel Master Data

#### Material
Master data material/bahan baku.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | SERIAL | PK | ID auto-increment |
| PartNumber | TEXT | UNIQUE, NOT NULL | Nomor part |
| PartName | TEXT | NOT NULL | Nama part |
| CreatedAt | TIMESTAMP | DEFAULT NOW() | Tanggal dibuat |
| CreatedBy | TEXT | NOT NULL | User pembuat |
| UpdatedAt | TIMESTAMP | | Tanggal update |
| Supplier | TEXT | | Nama supplier |
| SatuanId | INTEGER | FK (Satuan.Id) | Unit pengukuran |
| RackLocation | TEXT | | Lokasi rak |
| QtyRack | INTEGER | DEFAULT 0 | Qty di rak |
| QtyWarehouse | INTEGER | DEFAULT 0 | Qty di gudang |
| IsActive | BOOLEAN | DEFAULT true | Status aktif |
| DiscontinueDate | TIMESTAMP | | Tanggal discontinue |

#### FinishGood
Master data barang jadi.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | SERIAL | PK | ID auto-increment |
| PartNumber | TEXT | UNIQUE, NOT NULL | Nomor part |
| PartName | TEXT | NOT NULL | Nama part |
| Price | DOUBLE | DEFAULT 0 | Harga |
| Qty | INTEGER | DEFAULT 0 | Quantity |
| CreatedAt | TIMESTAMP | DEFAULT NOW() | Tanggal dibuat |
| CreatedBy | TEXT | NOT NULL | User pembuat |
| UpdatedAt | TIMESTAMP | | Tanggal update |

#### Satuan
Master unit pengukuran.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | SERIAL | PK | ID auto-increment |
| Name | TEXT | NOT NULL | Nama satuan |

#### Supplier
Master data supplier.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | SERIAL | PK | ID auto-increment |
| Name | TEXT | NOT NULL | Nama supplier |
| CreatedAt | TIMESTAMP | DEFAULT NOW() | Tanggal dibuat |

#### ManPower
Data tenaga kerja.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Uid | TEXT | PK, DEFAULT uuid(4) | UUID |
| Nik | TEXT | UNIQUE, NOT NULL | NIK |
| Name | TEXT | NOT NULL | Nama |
| Status | BOOLEAN | DEFAULT true | Status aktif |
| Line | TEXT | | Line produksi |
| CreatedAt | TIMESTAMP | DEFAULT NOW() | Tanggal dibuat |

### E.3.2 Tabel Transaksi

#### InventoryLedger
Ledger untuk tracking semua mutasi inventory.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | TEXT | PK, DEFAULT uuid() | UUID |
| TransactionDate | TIMESTAMP | DEFAULT NOW() | Tanggal transaksi |
| ItemCategory | ItemCategory | NOT NULL | Kategori item |
| MaterialId | TEXT | FK (Material.PartNumber) | ID Material |
| FinishGoodId | TEXT | FK (FinishGood.PartNumber) | ID FG |
| Location | LocationType | NOT NULL | Lokasi |
| TransactionType | TransactionType | NOT NULL | Jenis transaksi |
| ReferenceDoc | TEXT | NOT NULL | Referensi dokumen |
| BalanceBefore | INTEGER | NOT NULL | Saldo sebelum |
| QtyIn | INTEGER | DEFAULT 0 | Masuk |
| QtyOut | INTEGER | DEFAULT 0 | Keluar |
| BalanceAfter | INTEGER | NOT NULL | Saldo setelah |
| CreatedBy | TEXT | NOT NULL | User |
| Notes | TEXT | | Catatan |

#### Incoming
Header barang masuk dari supplier.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | TEXT | PK | ID PO |
| PoId | TEXT | UNIQUE, NOT NULL | PO ID |
| Description | TEXT | | Deskripsi |
| SupplierId | INTEGER | FK (Supplier.Id) | Supplier |
| ReceivedBy | TEXT | NOT NULL | Penerima |
| ApprovedAt | TIMESTAMP | | Tanggal approve |
| ApprovedBy | TEXT | | User approver |
| Closed | BOOLEAN | DEFAULT false | Status closed |
| FileName | TEXT | | Nama file |
| FilePath | TEXT | | Path file |
| CreatedAt | TIMESTAMP | DEFAULT NOW() | |
| UpdatedAt | TIMESTAMP | | |

#### StockOpname
Header stock opname.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | TEXT | PK, DEFAULT uuid() | UUID |
| OpnameNumber | TEXT | UNIQUE | Nomor opname |
| Category | ItemCategory | NOT NULL | Kategori |
| Status | OpnameStatus | DEFAULT DRAFT | Status |
| CreatedBy | TEXT | NOT NULL | User pembuat |
| StartedAt | TIMESTAMP | | Mulai opname |
| CompletedAt | TIMESTAMP | | Selesai opname |
| CompletedBy | TEXT | | User penyelesai |
| Notes | TEXT | | Catatan |

### E.3.3 Tabel Produksi

#### Forecast
Jadwal forecasting/pemesanan.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | SERIAL | PK | ID auto-increment |
| PoId | TEXT | UNIQUE, NOT NULL | PO ID |
| Date | TIMESTAMP | NOT NULL | Tanggal PO |
| VendorCode | TEXT | NOT NULL | Kode vendor |
| VendorName | TEXT | NOT NULL | Nama vendor |
| DeliveryDate | TIMESTAMP | NOT NULL | Tanggal delivery |
| Qty | INTEGER | NOT NULL | Quantity |
| FinishGoodId | TEXT | FK (FinishGood.PartNumber) | ID FG |
| ProductionReleaseId | TEXT | FK (ProductionRelease.Id) | ID Release |

#### ProductionRelease
Header jadwal produksi.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | TEXT | PK, DEFAULT uuid() | UUID |
| ReleaseNumber | TEXT | UNIQUE, NOT NULL | Nomor release |
| PlanDate | TIMESTAMP | NOT NULL | Tanggal rencana |
| Status | ProductionStatus | DEFAULT DRAFT | Status |
| TotalTargetQty | INTEGER | DEFAULT 0 | Total target |
| TotalGoodQty | INTEGER | DEFAULT 0 | Total good |
| TotalNgQty | INTEGER | DEFAULT 0 | Total NG |
| CreatedBy | TEXT | NOT NULL | User pembuat |

#### ProductionReport
Laporan hasil produksi.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | SERIAL | PK | ID auto-increment |
| Date | TEXT | | Tanggal |
| Qty | INTEGER | DEFAULT 0 | Quantity |
| NgQty | INTEGER | DEFAULT 0 | Quantity NG |
| ManPowerUid | TEXT | FK (ManPower.Uid) | ID pekerja |
| FinishGoodId | TEXT | FK (FinishGood.PartNumber) | ID FG |
| ValidatedAt | TIMESTAMP | | Validasi |
| ValidatedBy | TEXT | | User validator |

#### LabelData
Data label barcode.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | SERIAL | PK | ID auto-increment |
| LabelNumber | TEXT | UNIQUE, NOT NULL | Nomor label |
| FinishGoodId | TEXT | FK (FinishGood.PartNumber) | ID FG |
| ForecastId | TEXT | FK (Forecast.PoId) | ID Forecast |
| Scanned | BOOLEAN | DEFAULT false | Status scan |
| QtyThisBox | INTEGER | DEFAULT 0 | Qty per box |

#### PokayokeScanHistory
History scan poka-yoke.

| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | SERIAL | PK | ID auto-increment |
| LabelNumber | TEXT | NOT NULL | Nomor label |
| PoId | TEXT | NOT NULL | PO ID |
| PartNumber | TEXT | NOT NULL | Part number |
| PartName | TEXT | NOT NULL | Part name |
| Status | PokayokeCompareStatus | NOT NULL | Hasil |
| CreatedBy | TEXT | NOT NULL | User |

### E.3.4 Tabel Authentication

#### MTCUserManagement
| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | TEXT | PK, DEFAULT uuid() | UUID |
| UserId | TEXT | UNIQUE, NOT NULL | User ID |
| Password | TEXT | | Password hash |
| Name | TEXT | NOT NULL | Nama |
| Email | TEXT | UNIQUE, NOT NULL | Email |
| PhoneNumber | TEXT | | No HP |
| IsActive | BOOLEAN | DEFAULT true | Status aktif |
| LastLogin | TIMESTAMP | | Login terakhir |
| RoleId | INTEGER | FK (MTCRole.Id) | Role |
| AuthProvider | TEXT | DEFAULT LOCAL | Provider auth |

#### MTCRole
| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | SERIAL | PK | ID auto-increment |
| RoleName | TEXT | UNIQUE, NOT NULL | Nama role |
| Description | TEXT | | Deskripsi |

#### ApiKey
| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| Id | TEXT | PK, DEFAULT uuid() | UUID |
| KeyHash | TEXT | UNIQUE, NOT NULL | Hash API key |
| KeyPrefix | TEXT | NOT NULL | Prefix untuk display |
| Name | TEXT | NOT NULL | Nama |
| UserId | TEXT | FK (MTCUserManagement.UserId) | Owner |
| IsActive | BOOLEAN | DEFAULT true | Status aktif |
| LastUsedAt | TIMESTAMP | | Terakhir digunakan |

#### MTCUserSession
| Column | Type | Constraints | Keterangan |
|--------|------|-------------|------------|
| SessionId | TEXT | PK, DEFAULT uuid() | UUID |
| UserId | TEXT | NOT NULL | User ID |
| UserAgent | TEXT | NOT NULL | User agent |
| IpAddress | TEXT | NOT NULL | IP address |
| IsActive | BOOLEAN | DEFAULT true | Status aktif |
| ExpiresAt | TIMESTAMP | NOT NULL | Expired |

---

## E.4 Script Migrasi Database

### E.4.1 Lokasi Migrasi

`
prisma/migrations/
`

### E.4.2 Daftar Migrasi

| No | Tanggal | Nama |
|----|---------|------|
| 1 | 2026-06-04 | init_db_schema |
| 2 | 2026-06-04 | add_audit_log_process |
| 3 | 2026-06-06 | auth_schema |
| 4 | 2026-06-06 | auth_user_dept |
| 5 | 2026-06-06 | prod_release_schema |
| 6 | 2026-06-07 | update |
| 7 | 2026-06-08 | closed |
| 8 | 2026-06-08 | update |
| 9 | 2026-06-09 | prod_report |
| 10 | 2026-06-11 | material_rack |
| 11 | 2026-06-11 | sto_wh_rack |
| 12 | 2026-06-11 | material_dn |
| 13 | 2026-06-12 | transfer_dn |
| 14 | 2026-06-16 | delivery_attachment |
| 15 | 2026-06-17 | update |
| 16 | 2026-07-14 | incoming_attachment |
| 17 | 2026-07-14 | printer_setting |
| 18 | 2026-07-15 | incoming_material_qtychecked |
| 19 | 2026-07-20 | api_key |
| 20 | 2026-07-20 | discontinue_date |

### E.4.3 Command Migrasi

`ash
# Generate Prisma Client
pnpm prisma generate

# Run migrations
pnpm prisma migrate deploy

# Reset database
pnpm prisma migrate reset

# Create new migration
pnpm prisma migrate dev --name migration_name
`


---

# F. API & Integrasi

## F.1 Dokumentasi API

API menggunakan RESTful dengan format JSON. Dokumentasi Swagger tersedia untuk development.

Base URL:
- Development: http://localhost:7500
- Staging: https://staging-api.ansei.vuteq.my.id

### F.1.1 Authentication Endpoints

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | /auth/login | Login user |
| POST | /auth/logout | Logout user |
| GET | /auth/profile | Get user profile |
| GET | /auth/sessions | Get active sessions |

### F.1.2 Master Data Endpoints

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | /master/material | IPCS.MASTER_READ |
| GET | /master/material/:id | IPCS.MASTER_READ |
| POST | /master/material | IPCS.MASTER_CREATE |
| PATCH | /master/material/:id | IPCS.MASTER_UPDATE |
| DELETE | /master/material/:id | IPCS.MASTER_DELETE |
| GET | /master/finish-good | IPCS.MASTER_READ |
| POST | /master/finish-good | IPCS.MASTER_CREATE |
| GET | /master/satuan | IPCS.MASTER_READ |
| GET | /master/supplier | IPCS.MASTER_READ |

### F.1.3 Production Endpoints

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | /production/forecast | IPCS.FORECAST_READ |
| POST | /production/forecast | IPCS.FORECAST_CREATE |
| POST | /production/forecast/import | IPCS.FORECAST_CREATE |
| GET | /production/production-release | IPCS.PROD_READ |
| POST | /production/production-release | IPCS.PROD_CREATE |
| GET | /production/pokayoke | IPCS.POKAYOKE_READ |
| POST | /production/pokayoke/validate | IPCS.POKAYOKE_CREATE |

### F.1.4 Warehouse Endpoints

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | /warehouse/incoming | IPCS.INCOMING_READ |
| POST | /warehouse/incoming | IPCS.INCOMING_CREATE |
| POST | /warehouse/incoming/:id/approve | IPCS.INCOMING_UPDATE |
| GET | /warehouse/transfer | IPCS.TRANSFER_READ |

### F.1.5 Inventory Endpoints

| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | /inventory-counting | IPCS.INVENTORY_READ |
| POST | /inventory-counting | IPCS.INVENTORY_CREATE |
| POST | /inventory-counting/:id/start | IPCS.INVENTORY_UPDATE |
| POST | /inventory-counting/:id/close | IPCS.INVENTORY_UPDATE |

### F.1.6 Response Format

Success: { data: object, message: "Success" }
Error: { statusCode: number, message: string }

---

## F.2 Authentication

### F.2.1 Authentication Methods

1. JWT Token - Primary authentication
2. Microsoft SSO - Azure AD integration
3. API Key - For integrations

### F.2.2 JWT Authentication

POST /auth/login with { email, password }
Returns: { AccessToken: string, expiresIn: number }

Usage: Authorization: Bearer <token>

### F.2.3 Microsoft SSO

Supports Azure AD authentication for enterprise login.

Flow:
1. GET /auth/microsoft - Redirect to Microsoft
2. User authenticates
3. GET /auth/microsoft/callback - Get user data
4. POST /auth/sso-callback - Exchange token

### F.2.4 Session Management

- Sessions stored in MTCUserSession table
- JWT expires in 24 hours
- Multiple sessions allowed
- Sessions can be revoked via /auth/logout

---

## F.3 Integrasi Eksternal

### F.3.1 Azure AD Configuration

Environment variables:
AZURE_AD_CLIENT_ID
AZURE_AD_TENANT_ID
AZURE_AD_CLIENT_SECRET

### F.3.2 SMTP Configuration

Environment variables:
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER
SMTP_PASS
SMTP_FROM

---

## F.4 API Key Management

### F.4.1 Create API Key

POST /user-management/api-keys
Request: { name: string, description?: string }

Returns: { key: string, keyPrefix: string, id: string }

### F.4.2 Usage

Headers: X-API-Key: <key>

### F.4.3 Security

- Key hash stored (SHA-256)
- Key prefix for identification
- Can be deactivated
- Last used tracking

---

# G. Infrastruktur

## G.1 Server dan Spesifikasi

### G.1.1 Server Overview

| Environment | Purpose |
|-------------|---------|
| Staging | Testing & Integration |

Docker container runs on Ubuntu server with:
- Node.js 22 Alpine base image
- Non-root user (nestjs)
- Health check enabled
- Port 7500 exposed

---

## G.2 IP/Domain

### G.2.1 Domain Configuration

| Environment | Domain | Port |
|-------------|--------|------|
| Staging | staging-api.ansei.vuteq.my.id | 7500 |

### G.2.2 Local Development

| Service | Host | Port |
|---------|------|------|
| API | localhost | 7500 |
| PostgreSQL | localhost | 5432 |
| Redis | localhost | 6379 |

---

## G.3 DNS

DNS records managed by DNS provider.
Record type: A or CNAME pointing to server IP.

---

## G.4 SSL Certificate

HTTPS enabled on production/staging servers.
Certificate management via Let's Encrypt or cloud provider.

---

# H. Deployment

## H.1 Deployment Guide

### H.1.1 Prerequisites

- Docker and Docker Compose installed
- PostgreSQL database
- Redis server

### H.1.2 Environment Variables

Create .env file with required variables:

`
DATABASE_URL=postgresql://postgres:password@host:5432/ansei
PORT=7500
NODE_ENV=production
SECRET_KEY=your-secure-secret-key
JWT_EXPIRES_IN=24h
REDIS_HOST=redis
REDIS_PORT=6379
`

### H.1.3 Docker Deployment

`ash
# Pull latest image
docker pull vuteq/api-ansei-revamp:staging

# Run container
docker run -d --name api-ansei -p 7500:7500 --env-file .env vuteq/api-ansei-revamp:staging
`

### H.1.4 Docker Compose Deployment

`yaml
version: '3.8'
services:
  app:
    image: vuteq/api-ansei-revamp:staging
    ports:
      - \"7500:7500\"
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
  postgres:
    image: postgres:15
  redis:
    image: redis:7-alpine
`

### H.1.5 Local Development Deployment

`ash
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
pnpm run start:dev
`

---

## H.2 CI/CD

### H.2.1 CI/CD Pipeline

GitHub Actions workflow defined in .github/workflows/ci-cd.yml

### H.2.2 Pipeline Stages

| Stage | Job | Trigger |
|-------|-----|---------|
| 1 | Test | Every push |
| 2 | Build | After test pass |
| 3 | Docker Build | After build pass |
| 4 | Deploy Staging | Push to staging |
| 5 | Security Scan | After docker build |

### H.2.3 GitHub Actions Workflow

Triggers:
- Push to staging branch
- Pull request to staging branch

Jobs:
1. test - Run unit tests and coverage
2. build - Build application
3. docker - Build and push Docker image
4. deploy-staging - Deploy to staging server
5. security-scan - Trivy vulnerability scan

### H.2.4 Required Secrets

| Secret | Keterangan |
|--------|------------|
| DOCKERHUB_USERNAME | Docker Hub username |
| DOCKERHUB_TOKEN | Docker Hub access token |
| STAGING_HOST | Staging server IP |
| STAGING_USERNAME | SSH username |
| STAGING_PASSWORD | SSH password |
| FONNTE_KEY | Fonnte API key |

---

## H.3 Rollback Procedure

### H.3.1 Rollback Steps

`ash
# SSH to server
ssh user@staging-server

# Navigate to deployment directory
cd /home/staging/Ansei

# Check available images
docker images vuteq/api-ansei-revamp

# Pull specific previous version
docker pull vuteq/api-ansei-revamp:<commit-hash>

# Restart container with previous image
docker compose pull app
docker compose up -d app

# Verify deployment
docker compose logs -f app
curl http://localhost:7500/health
`

### H.3.2 Database Rollback

`ash
# Check migration status
pnpm prisma migrate status

# Rollback last migration
pnpm prisma migrate rollback
`

### H.3.3 Emergency Rollback

`ash
docker compose down
docker pull vuteq/api-ansei-revamp:<working-tag>
docker compose up -d app
`

---

## End of Document

**Document Version:** 1.0.0
**Last Updated:** 21 Juli 2026
**Author:** Development Team
