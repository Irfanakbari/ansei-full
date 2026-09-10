# SKILL.md - ANSEI API Revamp Skills

Dokumentasi skill dan capability untuk project ANSEI API Revamp (MES & Warehouse Management System).

---

## 1. Core Skills

### 1.1 NestJS Development
- **NestJS v11** dengan TypeScript v5
- Modular architecture dengan dependency injection
- Controller → Service → Prisma service pattern
- Custom module creation (module, controller, service, dto, entity, spec files)

### 1.2 Prisma ORM
- Schema management di `prisma/schema.prisma`
- Generate client: `pnpm prisma generate`
- Migration: `pnpm prisma migrate dev`
- Custom output path: `src/generated/prisma/`
- Import types dari `src/generated/prisma/models/` (suffix: `Model`)
- Import enums dari `src/generated/prisma/enums.ts`

### 1.3 Database Operations
- PostgreSQL database
- Prisma service singleton pattern
- Transaction handling dengan `$transaction`
- ID types: `number` untuk auto-increment, `string` untuk UUID

---

## 2. Module Development Skills

### 2.1 Creating New Module

Struktur folder berdasarkan kategori:

```
src/
├── master/                    # Master Data
│   └── {name}/
│       ├── {name}.module.ts
│       ├── {name}.controller.ts
│       ├── {name}.service.ts
│       ├── {name}.service.spec.ts
│       ├── {name}.controller.spec.ts
│       └── dto/
│           ├── create-{name}.dto.ts
│           ├── update-{name}.dto.ts
│           └── index.ts
│
├── production/                 # Production
│   └── {name}/
│       └── ...
│
├── warehouse/                  # Warehouse
│   └── {name}/
│       └── ...
```

### 2.2 Required Patterns

#### Controller Pattern
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

#### Service Pattern
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';
import { CreateXxxDto, UpdateXxxDto } from './dto';
import type { LogProcessModel, XxxModel } from '../../generated/prisma/models';

@Injectable()
export class XxxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logService: LogProcessService,
  ) {}

  // All business logic here
  // Prisma calls here
  // Logging here
}
```

### 2.3 DTO Validation
- Use `class-validator` decorators
- Common: `@IsString()`, `@IsNumber()`, `@IsEnum()`, `@IsOptional()`, `@IsUUID()`, `@IsNotEmpty()`
- Use `PartialType` from `@nestjs/mapped-types` for update DTOs

---

## 3. Audit Logging Skills

### 3.1 LogProcess Service Usage
```typescript
// Inject LogProcessService
constructor(
  private readonly prisma: PrismaService,
  private readonly logService: LogProcessService,
) {}

// Start process
const logProcess = await this.logService.startProcess({
  functionId: 'MODULE_001',
  functionName: 'createXxx',
  createdBy: 'user-id-or-system',
});

// Add log details
await this.logService.addLog({
  processId: logProcess.ProcessId,
  message: 'Description of the step',
  type: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
  location: 'filename.ts:lineNumber',
});

// Complete process
await this.logService.completeProcess(
  logProcess.ProcessId,
  'SUCCESS' | 'FAILED',
  'End message',
);
```

### 3.2 Complete Service Pattern with Logging
```typescript
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
      message: `Creating xxx with data: ${JSON.stringify(dto)}`,
      type: 'INFO',
      location: 'xxx.service.ts:35',
    });

    // Business logic
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
```

### 3.3 Logging Checklist
- [ ] LogProcess created at START
- [ ] LogProcessDetail for each significant step
- [ ] LogProcess status updated at END
- [ ] Error logged with type `ERROR`
- [ ] Location format: `filename.ts:lineNumber`

---

## 4. Inventory Ledger Skills

### 4.1 Core Rule
**InventoryLedger is the ONLY source of truth for stock quantities.**

### 4.2 Ledger Entry Pattern
```typescript
await tx.inventoryLedger.create({
  data: {
    Id: crypto.randomUUID(),
    ItemCategory: 'MATERIAL' | 'FINISH_GOOD',
    MaterialId: String(materialId),  // Always String in ledger
    FinishGoodId: finishGoodId ? String(finishGoodId) : null,
    Location: 'WAREHOUSE' | 'RACK' | 'FINISH_GOOD_AREA',
    TransactionType: 'INCOMING_SUPPLIER' | 'TRANSFER_TO_RACK' | 'PRODUCTION_USAGE' | etc,
    ReferenceDoc: referenceDocument,
    BalanceBefore: previousBalance,
    QtyIn: qtyIn,
    QtyOut: qtyOut,
    BalanceAfter: newBalance,
    CreatedBy: createdBy,
  },
});
```

### 4.3 Available Enums
```typescript
// Location Type
LocationType: 'WAREHOUSE' | 'RACK' | 'FINISH_GOOD_AREA'

// Transaction Type
TransactionType: 'INCOMING_SUPPLIER' | 'TRANSFER_TO_RACK' | 'PRODUCTION_USAGE' | 
                  'PRODUCTION_RESULT' | 'DELIVERY_TO_CUSTOMER' | 'NG_SCRAP' | 
                  'ADJUSTMENT_MANUAL' | 'STOCK_OPNAME_DIFF' | 'MATERIAL_OUT_DELIVERY'

// Item Category
ItemCategory: 'MATERIAL' | 'FINISH_GOOD'
```

---

## 5. Common Commands

```bash
# Generate Prisma Client
pnpm prisma generate

# Run migrations
pnpm prisma migrate dev --name migration_name

# Studio (GUI)
pnpm prisma studio

# Build
pnpm run build

# Start dev
pnpm run start:dev

# Start production
pnpm run start:prod
```

---

## 6. Error Handling Patterns

```typescript
// Not Found
throw new NotFoundException(`Entity with id ${id} not found`);

// Bad Request
throw new BadRequestException('Invalid input data');

// Conflict (for duplicates)
throw new ConflictException(`Entity with field ${value} already exists`);

// Internal Error
throw new InternalServerErrorException('Database error');
```

Always wrap operations in try-catch and log errors via LogProcessService.

---

## 7. TypeScript Guidelines

### 7.1 Strict Typing
- NO `any` type allowed
- Use interfaces and types for all DTOs
- Import generated types from `src/generated/prisma/models/`
- **Model types use suffix `Model`** (e.g., `MaterialModel`, `LogProcessModel`)

### 7.2 Import Patterns
```typescript
// Enums
import { ItemCategory, TransactionType, LocationType } from '../../../generated/prisma/enums';

// Model types (barrel export)
import type { MaterialModel, FinishGoodModel, InventoryLedgerModel } from '../../../generated/prisma/models';

// Prisma service
import { PrismaService } from '../../prisma/prisma.service';

// Log service
import { LogProcessService } from '../../common/log-process/log-process.service';

// Current user interface
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
```

### 7.3 ID Types
```typescript
// Auto-increment IDs (number)
Material.Id: number
FinishGood.Id: number

// UUID IDs (string)
InventoryLedger.Id: string
StockOpname.Id: string
ProductionRelease.Id: string
```

---

## 8. Testing Guidelines

### 8.1 Unit Test Pattern
```typescript
// xxx.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { XxxService } from './xxx.service';
import { PrismaService } from '../../prisma/prisma.service';
import { LogProcessService } from '../../common/log-process/log-process.service';

describe('XxxService', () => {
  let service: XxxService;
  let prismaService: PrismaService;
  let logService: LogProcessService;

  const mockPrismaService = {
    xxx: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockLogService = {
    startProcess: jest.fn(),
    addLog: jest.fn(),
    completeProcess: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        XxxService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LogProcessService, useValue: mockLogService },
      ],
    }).compile();

    service = module.get<XxxService>(XxxService);
    prismaService = module.get<PrismaService>(PrismaService);
    logService = module.get<LogProcessService>(LogProcessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Add more tests...
});
```

---

## 9. Quality Checklist

Before committing code:

- [ ] No `any` types
- [ ] All DTOs have validation decorators
- [ ] All write operations have audit logging
- [ ] All inventory changes create ledger entries
- [ ] Error handling with try-catch
- [ ] Service has LogProcessService injected
- [ ] Location in logs use `filename.ts:lineNumber`
- [ ] Prisma schema updated if new models added
- [ ] Run `pnpm prisma generate` after schema changes
- [ ] Unit tests created for new modules

---

## 10. Module Categories

### Master Data (`/master/`)
- satuan, supplier, material, finish-good, bill-of-materials, box-qty, man-power

### Production (`/production/`)
- delivery, forecast, pokayoke, pre-delivery, production-release, production-report, shopping

### Warehouse (`/warehouse/`)
- incoming, transfer

### Other Modules
- inventory-counting (Stock Opname)
- material-delivery-note (Surat Jalan Material)
- system-log (System Log Viewer)
- user-management (User Management)
- settings (Dashboard Setting, Email Notification)

---

*Last updated: June 2026*
