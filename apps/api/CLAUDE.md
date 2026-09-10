# Dokumentasi Proyek API ANSEI Revamp

Sistem Produksi (MES) dan Warehouse Management System untuk lini produksi ANSEI dengan prinsip **Toyota Production System (TPS)** dan **Poka-Yoke (Error Proofing)**.

---

## 1. Gambaran Umum

### Tech Stack
- **Backend:** NestJS v11, TypeScript v5, Prisma ORM v7
- **Database:** PostgreSQL
- **ORM Output:** Custom path `src/generated/prisma`
- **Database Schema:** Selalu lihat `prisma/schema.prisma` sebagai SOURCE OF TRUTH untuk struktur database

### Struktur Direktori

```
src/
├── generated/prisma/          # Auto-generated oleh Prisma (JANGAN EDIT!)
│   ├── models/                # Type definitions untuk setiap model (suffix: Model)
│   ├── enums.ts               # Semua enum definitions
│   └── client.ts              # PrismaClient singleton
├── prisma/
│   ├── prisma.service.ts      # NestJS Prisma Service (DI container)
│   └── schema.prisma          # Database schema (SOURCE OF TRUTH)
│
├── auth/                       # Authentication & Authorization
│   ├── interfaces/
│   │   └── current-user.interface.ts  # ICurrentUser interface
│   ├── strategies/             # JWT strategies
│   ├── guards/                  # JwtAuthGuard, PermissionsGuard
│   ├── decorators/             # CurrentUser, Permission, Public
│   └── auth.module.ts
│
├── common/                    # Shared utilities
│   ├── filters/               # Exception filters
│   ├── log-process/           # Audit logging (LogProcessService)
│   └── utils/                # Middleware, helpers
│
├── master/                    # Master Data Modules
│   ├── satuan/
│   ├── supplier/
│   ├── material/
│   ├── finish-good/
│   ├── bill-of-materials/
│   ├── box-qty/
│   └── man-power/
│
├── production/               # Production Modules
│   ├── delivery/
│   ├── forecast/
│   ├── pokayoke/
│   ├── pre-delivery/
│   ├── production-release/
│   ├── production-report/
│   └── shopping/
│
├── warehouse/                # Warehouse Modules
│   ├── incoming/
│   └── transfer/
│
├── inventory-counting/       # Stock Opname
├── material-delivery-note/   # Surat Jalan Material
├── system-log/             # System Log Viewer
├── user-management/        # User Management
├── settings/               # App Settings
│   ├── dashboard-setting/
│   └── email-notification/
│
├── app.module.ts           # Root module
└── main.ts                 # Entry point
```

---

## 2. Aturan Coding & Standar Pengembangan

### 2.1 Prinsip Arsitektur

#### ✅ WAJIB DIIKUTI

1. **Single Responsibility Principle (SRP)**
   - `Controller`: Hanya handle HTTP routing, request/response, validasi dasar
   - `Service`: Semua business logic ada di sini, termasuk pemanggilan Prisma
   - `Module`: Dependency injection definition

2. **Strict Typing**
   - DILARANG menggunakan `any` type
   - Semua DTO, response, dan variable harus punya interface/type yang jelas
   - Import type dari `src/generated/prisma/models/` dan `src/generated/prisma/enums.ts`
   - **Model types menggunakan suffix `Model`** (contoh: `MaterialModel`, `LogProcessModel`)

3. **Validasi Input**
   - Gunakan `class-validator` di DTO untuk validasi sebelum masuk service
   - Gunakan decorator: `@IsString()`, `@IsNumber()`, `@IsEnum()`, `@IsOptional()`, dll

4. **Error Handling**
   - Gunakan `BadRequestException`, `NotFoundException`, `InternalServerErrorException`
   - Buat custom exception jika perlu
   - Selalu return structured error response

5. **Inventory Ledger Pattern ⚠️**
   - `InventoryLedger` adalah SATU-SATUNYA source of truth untuk stok
   - `Material.QtyRack`, `Material.QtyWarehouse`, `FinishGood.Qty` adalah **CACHE** untuk UI saja
   - Setiap mutasi stok (in/out) HARUS buat entry di ledger
   - `BalanceAfter = BalanceBefore + QtyIn - QtyOut` (WAJIB dipertahankan)

6. **Audit Logging - LogProcess & LogProcessDetail ⚠️ WAJIB**
   - **SETIAP** operasi/service yang melakukan write ke database HARUS mencatat log
   - Buat entry di `LogProcess` untuk setiap proses utama
   - Buat entry di `LogProcessDetail` untuk setiap sub-langkah dalam proses
   - **Jangan** pernah skip logging, termasuk operasi kecil
   - Sertakan siapa yang melakukan proses, jika proses dilakukan oleh sistem maka 'SYSTEM'
   - Lihat section 3 untuk format dan contoh

7. **Unit Testing ⚠️ WAJIB**
   - Setiap modul baru HARUS memiliki file test
   - Pattern: `{nama}.service.spec.ts` dan `{nama}.controller.spec.ts`
   - Gunakan mocking untuk PrismaService dan LogProcessService

#### ❌ JANGAN LAKUKAN

1. Jangan letakkan business logic di controller
2. Jangan bypass service saat akses database
3. Jangan gunakan `any` type
4. Jangan buat endpoint tanpa validasi DTO
5. Jangan modify file di `src/generated/prisma/` (auto-generated!)
6. Jangan skip logging - **SELALU CATAT LOG**

### 2.2 Penamaan (Naming Conventions)

#### File Naming
```
Module: kebab-case (material.module.ts)
Controller: kebab-case (material.controller.ts)
Service: kebab-case (material.service.ts)
DTO: kebab-case dengan suffix (create-material.dto.ts, update-material.dto.ts)
Entity: kebab-case (material.entity.ts)
Test: kebab-case (material.service.spec.ts)
```

#### Code Naming
```
Class/Interface: PascalCase (MaterialService, CreateMaterialDto, LogProcessService)
Variable: camelCase (materialId, totalQty, isActive)
Constant: UPPER_SNAKE_CASE (MAX_RETRY_COUNT, DEFAULT_PAGE_SIZE)
Enum: PascalCase dengan UPPER_SNAKE_VALUE (TransactionType.INCOMING_SUPPLIER)
```

#### API Endpoint Naming
```
GET    /master/material             -> list all
GET    /master/material/:id         -> get one
POST   /master/material             -> create
PATCH  /master/material/:id         -> update partial
DELETE /master/material/:id         -> delete

GET    /master/material/part-number/:partNumber  -> get by part number
```

---

## 2.3 Authentication & Authorization

### 2.3.1 Overview

Semua endpoint harus diamankan dengan JWT authentication dan permission-based authorization.

### 2.3.2 ICurrentUser Interface

Data user yang login diambil dari decorator `@CurrentUser()`:

```typescript
// src/auth/interfaces/current-user.interface.ts
export interface ICurrentUser {
  username: string;
  name: string;
  email: string;
  roleId: number | null;
  roleName?: string;
  sessionId: string;
  permissions: string[];
  departments: string[];
}
```

### 2.3.3 Permission Naming Convention

Format permission: `{FOLDER_NAME}_{CRUD_ACTION}`

| Folder | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| `master` | `MASTER_CREATE` | `MASTER_READ` | `MASTER_UPDATE` | `MASTER_DELETE` |
| `incoming` | `INCOMING_CREATE` | `INCOMING_READ` | `INCOMING_UPDATE` | `INCOMING_DELETE` |
| `production` | `PRODUCTION_CREATE` | `PRODUCTION_READ` | `PRODUCTION_UPDATE` | `PRODUCTION_DELETE` |

### 2.3.4 Controller Template

```typescript
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { XxxService } from './xxx.service';
import { CreateXxxDto, UpdateXxxDto } from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('Xxx')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('path/to/resource')
export class XxxController {
  constructor(private readonly xxxService: XxxService) {}

  @Get()
  @Permission('FOLDER_READ')
  async findAll(@CurrentUser() _user: ICurrentUser) {
    return this.xxxService.findAll();
  }

  @Get(':id')
  @Permission('FOLDER_READ')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.xxxService.findOne(id);
  }

  @Post()
  @Permission('FOLDER_CREATE')
  async create(
    @Body() createXxxDto: CreateXxxDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.xxxService.create(createXxxDto, user.username);
  }

  @Patch(':id')
  @Permission('FOLDER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateXxxDto: UpdateXxxDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.xxxService.update(id, updateXxxDto, user.username);
  }

  @Delete(':id')
  @Permission('FOLDER_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.xxxService.remove(id, user.username);
  }
}
```

### 2.3.5 Guards

- **JwtAuthGuard**: Memvalidasi JWT token dari header `Authorization: Bearer <token>`
- **PermissionsGuard**: Memvalidasi apakah user memiliki permission yang diperlukan

### 2.3.6 Decorators

| Decorator | Usage | Description |
|-----------|-------|-------------|
| `@CurrentUser()` | `user: ICurrentUser` | Ambil data user yang login |
| `@Permission('XXX_CREATE')` | Di method | Set permission yang dibutuhkan |
| `@Public()` | Di method | Bypass auth (untuk login endpoint) |

### 2.3.7 Checklist Auth

- [ ] Tambahkan `@ApiTags()`, `@ApiBearerAuth()`, `@UseGuards(JwtAuthGuard, PermissionsGuard)` di controller level
- [ ] Tambahkan `@Permission('XXX_READ')` di setiap GET endpoint
- [ ] Tambahkan `@Permission('XXX_CREATE')` di setiap POST endpoint
- [ ] Tambahkan `@Permission('XXX_UPDATE')` di setiap PATCH/PUT endpoint
- [ ] Tambahkan `@Permission('XXX_DELETE')` di setiap DELETE endpoint
- [ ] Gunakan `@CurrentUser() user: ICurrentUser` untuk mendapat data user
- [ ] Gunakan `user.username` atau `user.email` untuk `CreatedBy` di audit logging

---

## 3. Audit Logging - LogProcess & LogProcessDetail

### 3.1 Format ID

#### ProcessId
Format: `PR{YYYYMMDD}{HHmmss}{6-digit-unique-id}`

```
Contoh: PR20260604143052123456
        └─ PR = Prefix Process
          └─ 20260604 = Tanggal (YYYYMMDD)
                   └─ 143052 = Waktu (HHmmss)
                          └─ 123456 = Unique ID (milidetik + random)
```

**Cara generate yang benar-benar unik:**
```typescript
function generateProcessId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const timePart = now.toISOString().slice(11, 19).replace(/:/g, ''); // HHmmss
  
  // Unique ID: milidetik + random 3 digit untuk handle race condition
  const msPart = now.getMilliseconds().toString().padStart(3, '0');
  const randPart = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const uniquePart = (parseInt(msPart + randPart) % 1000000).toString().padStart(6, '0');
  
  return `PR${datePart}${timePart}${uniquePart}`;
}
```

#### MessageId
Format: `COMM-{3-digit-increment}`

```
Contoh: COMM-001, COMM-002, COMM-003, ... COMM-999
        └─ COMM = Prefix Communication/Log
          └─ 001 = Urutan sub-proses (dimulai dari 001)
```

**Cara generate:**
```typescript
let messageCounter = 0;

function generateMessageId(): string {
  messageCounter++;
  if (messageCounter > 999) messageCounter = 1;
  return `COMM-${messageCounter.toString().padStart(3, '0')}`;
}

// Reset counter per process (biasanya di awal LogProcess)
function resetMessageCounter() {
  messageCounter = 0;
}
```

### 3.2 Struktur Data

#### LogProcess (1 entry per proses utama)
```typescript
interface CreateLogProcessInput {
  ProcessId: string;       // Format: PRYYYYMMDDHHmmssXXXXXX
  FunctionId: string;      // ID function/module (e.g., 'INCOMING_001')
  FunctionName: string;    // Nama function (e.g., 'createIncomingWithLedger')
  ProcessStatus: string;   // 'STARTED', 'SUCCESS', 'FAILED'
  ProcessStart: Date;      // Timestamp mulai
  ProcessEnd?: Date;       // Timestamp selesai (nullable)
  ProcessDate: Date;       // Tanggal proses
  CreatedAt: Date;         // Timestamp record dibuat
  CreatedBy?: string;      // User yang trigger (nullable)
}
```

#### LogProcessDetail (N entries per sub-proses)
```typescript
interface CreateLogProcessDetailInput {
  ProcessId: string;       // FK ke LogProcess.ProcessId
  MessageId: string;       // Format: COMM-001, COMM-002, dst
  Message: string;         // Deskripsi proses (Text - bisa panjang)
  Type: string;            // 'INFO', 'WARN', 'ERROR', 'DEBUG'
  Location: string;        // Lokasi/konteks (e.g., 'material.service.ts:45')
  ProcessDate: Date;      // Tanggal proses
  CreatedAt: Date;         // Timestamp record dibuat
}
```

### 3.3 Tipe Log Message

| Type | Usage | Contoh |
|------|-------|--------|
| `INFO` | Langkah normal dalam proses | "Memulai create incoming", "Ledger entry dibuat" |
| `WARN` | Warning tapi proses lanjut | "Stock kurang dari minimum", "Fallback to default" |
| `ERROR` | Error dalam proses | "Material tidak ditemukan", "Prisma error" |
| `DEBUG` | Detail debug (optional) | "Query result: 5 rows", "Variable value: ..." |

### 3.4 Contoh Implementasi

#### LogProcessService (sudah ada di common/log-process)
```typescript
// src/common/log-process/log-process.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  LogProcessModel,
  LogProcessDetailModel,
} from '../../generated/prisma/models';

@Injectable()
export class LogProcessService {
  private messageCounter = 0;

  constructor(private readonly prisma: PrismaService) {}

  private generateProcessId(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timePart = now.toISOString().slice(11, 19).replace(/:/g, '');
    const msPart = now.getMilliseconds().toString().padStart(3, '0');
    const randPart = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const uniquePart = (parseInt(msPart + randPart) % 1000000)
      .toString()
      .padStart(6, '0');
    return `PR${datePart}${timePart}${uniquePart}`;
  }

  private generateMessageId(): string {
    this.messageCounter++;
    if (this.messageCounter > 999) this.messageCounter = 1;
    return `COMM-${this.messageCounter.toString().padStart(3, '0')}`;
  }

  resetCounter(): void {
    this.messageCounter = 0;
  }

  async startProcess(params: {
    functionId: string;
    functionName: string;
    createdBy?: string;
  }): Promise<LogProcessModel> {
    this.resetCounter();
    const now = new Date();

    return this.prisma.logProcess.create({
      data: {
        ProcessId: this.generateProcessId(),
        FunctionId: params.functionId,
        FunctionName: params.functionName,
        ProcessStatus: 'STARTED',
        ProcessStart: now,
        ProcessDate: now,
        CreatedAt: now,
        CreatedBy: params.createdBy,
      },
    });
  }

  async addLog(params: {
    processId: string;
    message: string;
    type: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    location: string;
  }): Promise<LogProcessDetailModel> {
    const now = new Date();

    return this.prisma.logProcessDetail.create({
      data: {
        ProcessId: params.processId,
        MessageId: this.generateMessageId(),
        Message: params.message,
        Type: params.type,
        Location: params.location,
        ProcessDate: now,
        CreatedAt: now,
      },
    });
  }

  async completeProcess(
    processId: string,
    status: 'SUCCESS' | 'FAILED',
    endMessage?: string,
  ): Promise<void> {
    const now = new Date();

    if (endMessage) {
      await this.addLog({
        processId,
        message: endMessage,
        type: status === 'SUCCESS' ? 'INFO' : 'ERROR',
        location: 'LogProcessService',
      });
    }

    await this.prisma.logProcess.update({
      where: { ProcessId: processId },
      data: {
        ProcessStatus: status,
        ProcessEnd: now,
      },
    });
  }
}
```

#### Usage dalam Service (contoh: MaterialService)
```typescript
// src/master/material/material.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateMaterialDto, UpdateMaterialDto } from './dto';
import type {
  LogProcessModel,
  MaterialModel,
} from '../../generated/prisma/models';

@Injectable()
export class MaterialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async create(
    dto: CreateMaterialDto,
    createdBy: string,
  ): Promise<MaterialModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'MATERIAL_001',
        functionName: 'MaterialService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating material with part number: ${dto.partNumber}`,
        type: 'INFO',
        location: 'material.service.ts:45',
      });

      // Check if part number already exists
      const existing = await this.prisma.material.findUnique({
        where: { PartNumber: dto.partNumber },
      });

      if (existing) {
        throw new ConflictException(
          `Material with part number ${dto.partNumber} already exists`,
        );
      }

      const result = await this.prisma.material.create({
        data: {
          PartNumber: dto.partNumber,
          PartName: dto.partName,
          Supplier: dto.supplier,
          SatuanId: dto.satuanId,
          RackLocation: dto.rackLocation,
          QtyRack: dto.qtyRack ?? 0,
          QtyWarehouse: dto.qtyWarehouse ?? 0,
          CreatedBy: createdBy,
        },
        include: {
          SatuanData: true,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Material created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'material.service.ts:68',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'material.service.ts:78',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
```

### 3.5 Checklist Logging

- [ ] Setiap service method yang write ke DB harus punya logging
- [ ] `LogProcess` dibuat di AWAL proses
- [ ] `LogProcessDetail` dibuat untuk setiap langkah signifikan
- [ ] `LogProcess.ProcessEnd` dan `ProcessStatus` di-update di AKHIR proses
- [ ] Error selalu di-log dengan type `ERROR`
- [ ] `Location` diisi dengan format `filename.ts:lineNumber`

---

## 4. Struktur Kode per Module

### Module (xxx.module.ts)
```typescript
import { Module } from '@nestjs/common';
import { XxxController } from './xxx.controller';
import { XxxService } from './xxx.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

@Module({
  controllers: [XxxController],
  providers: [XxxService, PrismaService, LogProcessService],
  exports: [XxxService],
})
export class XxxModule {}
```

### Controller (xxx.controller.ts)
```typescript
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards, ParseIntPipe } from '@nestjs/common';
import { XxxService } from './xxx.service';
import { CreateXxxDto, UpdateXxxDto } from './dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('Xxx')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('path/to/resource')
export class XxxController {
  constructor(private readonly xxxService: XxxService) {}

  @Get()
  @Permission('FOLDER_READ')
  async findAll(@CurrentUser() _user: ICurrentUser) {
    return this.xxxService.findAll();
  }

  @Get(':id')
  @Permission('FOLDER_READ')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.xxxService.findOne(id);
  }

  @Post()
  @Permission('FOLDER_CREATE')
  async create(
    @Body() createXxxDto: CreateXxxDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.xxxService.create(createXxxDto, user.username);
  }

  @Patch(':id')
  @Permission('FOLDER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateXxxDto: UpdateXxxDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.xxxService.update(id, updateXxxDto, user.username);
  }

  @Delete(':id')
  @Permission('FOLDER_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.xxxService.remove(id, user.username);
  }
}
```

### Service (xxx.service.ts)
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateXxxDto, UpdateXxxDto } from './dto';
import type {
  LogProcessModel,
  XxxModel,
} from '../../generated/prisma/models';

@Injectable()
export class XxxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  async findAll(): Promise<XxxModel[]> {
    return this.prisma.xxx.findMany({
      orderBy: { Id: 'asc' },
    });
  }

  async findOne(id: number): Promise<XxxModel> {
    const result = await this.prisma.xxx.findUnique({
      where: { Id: id },
    });

    if (!result) {
      throw new NotFoundException(`Xxx with id ${id} not found`);
    }

    return result;
  }

  async create(dto: CreateXxxDto, createdBy: string): Promise<XxxModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'XXX_001',
        functionName: 'XxxService.Create',
        createdBy,
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Creating xxx with name: ${dto.name}`,
        type: 'INFO',
        location: 'xxx.service.ts:35',
      });

      const result = await this.prisma.xxx.create({
        data: {
          // ... fields
          CreatedBy: createdBy,
        },
      });

      await this.logService.addLog({
        processId: logProcess.ProcessId,
        message: `Xxx created successfully with id: ${result.Id}`,
        type: 'INFO',
        location: 'xxx.service.ts:42',
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.addLog({
          processId: logProcess.ProcessId,
          message: `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`,
          type: 'ERROR',
          location: 'xxx.service.ts:50',
        });
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateXxxDto, createdBy: string): Promise<XxxModel> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'XXX_002',
        functionName: 'XxxService.Update',
        createdBy,
      });

      const existing = await this.prisma.xxx.findUnique({ where: { Id: id } });
      if (!existing) {
        throw new NotFoundException(`Xxx with id ${id} not found`);
      }

      const result = await this.prisma.xxx.update({
        where: { Id: id },
        data: dto,
      });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return result;
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }

  async remove(id: number, createdBy: string): Promise<{ deleted: boolean; id: number }> {
    let logProcess: LogProcessModel | undefined;

    try {
      logProcess = await this.logService.startProcess({
        functionId: 'XXX_003',
        functionName: 'XxxService.Delete',
        createdBy,
      });

      const existing = await this.prisma.xxx.findUnique({ where: { Id: id } });
      if (!existing) {
        throw new NotFoundException(`Xxx with id ${id} not found`);
      }

      await this.prisma.xxx.delete({ where: { Id: id } });

      await this.logService.completeProcess(logProcess.ProcessId, 'SUCCESS');

      return { deleted: true, id };
    } catch (error) {
      if (logProcess) {
        await this.logService.completeProcess(logProcess.ProcessId, 'FAILED');
      }
      throw error;
    }
  }
}
```

### DTO (dto/create-xxx.dto.ts)
```typescript
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ItemCategory } from '../../../generated/prisma/enums';

export class CreateXxxDto {
  @IsString()
  name: string;

  @IsNumber()
  qty: number;

  @IsEnum(ItemCategory)
  category: ItemCategory;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateXxxDto extends PartialType(CreateXxxDto) {}
```

---

## 5. Prisma Usage Patterns

### Import Generated Types
```typescript
// Dari file enums
import { TransactionType, LocationType, ItemCategory } from '../../../generated/prisma/enums';

// Dari barrel export (semua model types - gunakan suffix Model)
import type { MaterialModel, FinishGoodModel, InventoryLedgerModel, LogProcessModel } from '../../../generated/prisma/models';

// Dari file spesifik model
import type { MaterialModel } from '../../../generated/prisma/models/Material.js';
```

### Transaction Pattern (dengan logging)
```typescript
async createWithLedgerAndLogging(dto: CreateDto, createdBy: string, logProcess: LogProcessModel) {
  return this.prisma.$transaction(async (tx) => {
    // Create main record
    const main = await tx.someModel.create({ data: dto });

    await this.logService.addLog({
      processId: logProcess.ProcessId,
      message: `Created main record with id: ${main.Id}`,
      type: 'INFO',
      location: 'service.ts:50',
    });

    // Create ledger entry
    await tx.inventoryLedger.create({
      data: {
        Id: crypto.randomUUID(),
        ItemCategory: dto.category,
        MaterialId: String(dto.materialId), // Always String in ledger
        Location: dto.location,
        TransactionType: dto.transactionType,
        ReferenceDoc: main.Id,
        BalanceBefore: 0,
        QtyIn: dto.qty,
        QtyOut: 0,
        BalanceAfter: dto.qty,
        CreatedBy: createdBy,
      },
    });

    await this.logService.addLog({
      processId: logProcess.ProcessId,
      message: `Created ledger entry for material ${dto.materialId}`,
      type: 'INFO',
      location: 'service.ts:68',
    });

    return main;
  });
}
```

---

## 6. Enums yang Tersedia

Lihat `src/generated/prisma/enums.ts` untuk enum lengkap:

```typescript
// Location Type
LocationType: 'WAREHOUSE' | 'RACK' | 'FINISH_GOOD_AREA'

// Transaction Type
TransactionType: 'INCOMING_SUPPLIER' | 'TRANSFER_TO_RACK' | 'PRODUCTION_USAGE' | 
                  'PRODUCTION_RESULT' | 'DELIVERY_TO_CUSTOMER' | 'NG_SCRAP' | 
                  'ADJUSTMENT_MANUAL' | 'STOCK_OPNAME_DIFF' | 'MATERIAL_OUT_DELIVERY'

// Item Category
ItemCategory: 'MATERIAL' | 'FINISH_GOOD'

// Opname Status
OpnameStatus: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

// Production Status
ProductionStatus: 'DRAFT' | 'RELEASED' | 'COMPLETED' | 'CANCELLED'

// Pokayoke Compare Status
PokayokeCompareStatus: 'SUKSES' | 'GAGAL'

// Delivery Note Status
DeliveryNoteStatus: 'DRAFT' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED'
```

---

## 7. Environment & Configuration

### Environment Variables (.env)
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
PORT=3000
NODE_ENV=development
SECRET_KEY=your-secret-key
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Key Configuration
- Prisma schema: `prisma/schema.prisma` (SELALU LIHAT UNTUK STRUKTUR DB)
- Prisma output: `src/generated/prisma`
- Migration path: `prisma/migrations`

### Important Commands
```bash
# Generate Prisma Client (setelah ubah schema)
pnpm prisma generate

# Run migration
pnpm prisma migrate dev

# Studio (GUI untuk DB)
pnpm prisma studio

# Build
pnpm run build

# Start dev
pnpm run start:dev
```

---

## 8. Catatan Penting

### ⚠️ Generated Files
- JANGAN edit file di `src/generated/prisma/`
- File tersebut di-generate ulang setiap kali `pnpm prisma generate` dijalankan
- Jika butuh custom type, buat di folder `entities/` dalam modul masing-masing

### ⚠️ Model Type Naming
- Semua model types menggunakan suffix `Model` (contoh: `MaterialModel`, `LogProcessModel`)
- Import dari `src/generated/prisma/models/` atau barrel export `src/generated/prisma/models.ts`

### ⚠️ ID Types
- Material, FinishGood, dll: `number` (Int, auto-increment)
- InventoryLedger, StockOpname, dll: `string` (UUID)
- Pastikan sesuai dengan schema Prisma

*Last updated: June 2026*
