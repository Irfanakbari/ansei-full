# API ANSEI Revamp - Documentation

## Project Overview

Sistem MES (Manufacturing Execution System) dan Warehouse Management untuk lini produksi ANSEI Indonesia dengan implementasi prinsip **Toyota Production System (TPS)** dan **Poka-Yoke (Error Proofing)**.

### Tech Stack
- **Backend:** NestJS v11, TypeScript v5, Prisma ORM v7
- **Database:** PostgreSQL
- **Output Path:** `src/generated/prisma`

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Frontend)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ANSEI (NestJS)                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         AUTHENTICATION                                  │ │
│  │  • JWT + Session Management                                            │ │
│  │  • Permission-based Authorization                                      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                        │                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │    MASTER    │ │  PRODUCTION  │ │   WAREHOUSE  │ │    SYSTEM    │         │
│  │              │ │              │ │              │ │              │         │
│  │ • Material   │ │ • Forecast   │ │ • Incoming   │ │ • SystemLog  │         │
│  │ • FinishGood │ │ • Prod.Release│ │ • Transfer   │ │ • Settings   │         │
│  │ • Supplier   │ │ • Prod.Report│ │ • Stock      │ │              │         │
│  │ • BillOfMat  │ │ • Shopping   │ │   Opname     │ │              │         │
│  │ • BoxQty     │ │ • Pokayoke   │ │ • Transfer   │ │              │         │
│  │ • ManPower   │ │ • Delivery   │ │   Material   │ │              │         │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘         │
│                                        │                                      │
│                                        ▼                                      │
│                              PostgreSQL Database                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Business Process Overview

Dokumentasi ini menjelaskan alur proses bisnis sistem secara detail, mencakup:

1. **Material Flow** - Alur barang dari Supplier hingga ke Rak
2. **Production Flow** - Alur produksi dari Forecast hingga Delivery
3. **Stock Opname Flow** - Alur stock opname dan penyesuaian stok
4. **Material Transfer Flow** - Alur pengiriman material ke Sprocket

---

# ============================================================================
# 1. MATERIAL FLOW (Incoming to Rack)
# ============================================================================

## Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SUPPLIER  │────▶│  INCOMING   │────▶│   CHECK /   │────▶│  STOCK IN   │
│  (Deliver)  │     │  (Receive)  │     │   APPROVE   │     │  WAREHOUSE  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                    │                   │
                          │                    │                   │
                          ▼                    ▼                   ▼
                    ┌─────────────┐       ┌─────────────┐     ┌─────────────┐
                    │  Supplier   │       │   Incoming  │     │  Inventory  │
                    │  Document   │       │   Items     │     │   Ledger    │
                    │  (Surat     │       │  (Pending)  │     │  (INCOMING  │
                    │   Jalan)    │       │             │     │   _SUPPLIER)│
                    └─────────────┘       └─────────────┘     └─────────────┘
                                                │
                                                │ (After Approval)
                                                ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   RACK      │◀────│  TRANSFER   │◀────│  STOCK OUT  │     │  STOCK IN   │
│  LOCATION   │     │   REQUEST   │     │  WAREHOUSE  │────▶│    RACK      │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                          │                    │                   │
                          ▼                    ▼                   ▼
                    ┌─────────────┐       ┌─────────────┐     ┌─────────────┐
                    │   Transfer  │       │  Inventory  │     │  Inventory  │
                    │   Items     │       │   Ledger    │     │   Ledger    │
                    │  (Pending)  │       │ (TRANSFER   │     │ (TRANSFER   │
                    │             │       │  _TO_RACK)  │     │  _TO_RACK)  │
                    └─────────────┘       └─────────────┘     └─────────────┘
```

## Step-by-Step Detail

### Step 1: Supplier Delivers Material
**Actors:** Supplier / Procurement Team

- Supplier mengirimkan material beserta Surat Jalan (Delivery Note)
- Material tiba di area receiving warehouse

---

### Step 2: Create Incoming Record (Penerimaan)
**Endpoint:** `POST /warehouse/incoming`
**Actors:** Warehouse Staff
**Permission:** `INCOMING_CREATE`

**Input:**
- `SupplierId` - ID Supplier
- `SupplierDocNo` - No. Surat Jalan Supplier
- `Items[]` - Array material yang diterima
  - `MaterialId` - ID Material (dari Master Data)
  - `QtyReceived` - Jumlah yang diterima
  - `QtyRejected` - Jumlah yang ditolak (jika ada)
  - `SatuanId` - Unit pengukuran
  - `PartNumber` - Part number material

**Data Created:**
```
Incoming:
  - IncomingNo: auto-generated (INC-YYYYMMDD-XXXX)
  - IncomingDate: current date
  - Status: PENDING_APPROVAL
  - SupplierId: from input
  - SupplierDocNo: from input
  - CreatedBy: username

IncomingItem:
  - MaterialId: from input
  - QtyReceived: from input
  - QtyRejected: from input (default 0)
  - Sat
```

**Action:** System creates Incoming record with status `PENDING_APPROVAL`

---

### Step 3: Check & Approve Incoming
**Endpoint:** `PATCH /warehouse/incoming/:id/approve`
**Actors:** QC / Warehouse Supervisor
**Permission:** `INCOMING_UPDATE`

**Process:**
1. QC memeriksa fisik material sesuai Surat Jalan
2. Jika ada perbedaan (qty mismatch, kerusakan):
   - Update `IncomingItem.QtyRejected`
   - Catat alasan penolakan
3. Jika OK, set status menjadi `APPROVED`

**Validation Rules:**
- [ ] Jumlah yang diterima vs Surat Jalan harus tercatat
- [ ] Material harus ada di Master Data
- [ ] QC Personel harus tera
```

---

### Step 4: Stock In to Warehouse (After Approval)
**Endpoint:** `PATCH /warehouse/incoming/:id/stock-in`
**Actors:** Warehouse Staff (System Automated)
**Permission:** `INCOMING_UPDATE`

**Process:**
1. System mengupdate status menjadi `STOCKED_IN`
2. System membuat Inventory Ledger entries:

```
InventoryLedger (INCOMING_SUPPLIER):
  - Id: UUID
  - ItemCategory: MATERIAL
  - MaterialId: String(materialId)
  - LocationType: WAREHOUSE
  - TransactionType: INCOMING_SUPPLIER
  - ReferenceDoc: IncomingNo
  - BalanceBefore: current_stock
  - QtyIn: approved_qty
  - QtyOut: 0
  - BalanceAfter: BalanceBefore + QtyIn
  - CreatedBy: username
```

3. System mengupdate Material cache:
```typescript
Material.QtyWarehouse += approved_qty
```

**Status Flow:**
```
PENDING_APPROVAL → APPROVED → STOCKED_IN
```

---

### Step 5: Create Transfer Request (Rack Placement)
**Endpoint:** `POST /warehouse/transfer`
**Actors:** Warehouse Staff / Supervisor
**Permission:** `TRANSFER_CREATE`

**Input:**
- `TransferType`: RACK_PLACEMENT
- `SourceLocation`: WAREHOUSE
- `DestinationLocation`: RACK
- `Items[]`:
  - `MaterialId`: ID Material
  - `Qty`: Jumlah yang dipindahkan

**Data Created:**
```
MaterialTransfer:
  - TransferNo: auto-generated (TRF-YYYYMMDD-XXXX)
  - TransferDate: current date
  - TransferType: RACK_PLACEMENT
  - Status: PENDING_PICKING
  - SourceLocation: WAREHOUSE
  - DestinationLocation: RACK
  - CreatedBy: username

MaterialTransferItem:
  - MaterialId: from input
  - Qty: from input
  - Status: PENDING
```

---

### Step 6: Picking Material from Warehouse
**Actors:** Warehouse Staff
**Permission:** `TRANSFER_UPDATE`

**Process:**
1. Staff mengambil material dari rack/location di warehouse
2. Staff men-scan atau input actual qty yang diambil
3. System update TransferItem status menjadi `PICKED`

---

### Step 7: Stock Out from Warehouse
**Endpoint:** `PATCH /warehouse/transfer/:id/stock-out`
**Actors:** Warehouse Staff (System Automated)
**Permission:** `TRANSFER_UPDATE`

**Process:**
1. System membuat Inventory Ledger entry untuk Stock Out:

```
InventoryLedger (TRANSFER_TO_RACK):
  - Id: UUID
  - ItemCategory: MATERIAL
  - MaterialId: String(materialId)
  - LocationType: WAREHOUSE
  - TransactionType: TRANSFER_TO_RACK
  - ReferenceDoc: TransferNo
  - BalanceBefore: current_qty
  - QtyIn: 0
  - QtyOut: transfer_qty
  - BalanceAfter: BalanceBefore - QtyOut
  - CreatedBy: username
```

2. System mengurangi Material cache:
```typescript
Material.QtyWarehouse -= transfer_qty
```

---

### Step 8: Stock In to Rack
**Endpoint:** `PATCH /warehouse/transfer/:id/stock-in-rack`
**Actors:** Warehouse Staff (System Automated)
**Permission:** `TRANSFER_UPDATE`

**Process:**
1. Staff menempatkan material di rack location
2. Staff men-scan atau konfirmasi lokasi rak
3. System update Transfer status menjadi `COMPLETED`

**Data Updates:**
```
Material.RackLocation: assigned_rack_location
Material.QtyRack += transfer_qty
```

4. System membuat Inventory Ledger entry untuk Stock In Rack:

```
InventoryLedger (TRANSFER_TO_RACK):
  - Id: UUID
  - ItemCategory: MATERIAL
  - MaterialId: String(materialId)
  - LocationType: RACK
  - TransactionType: TRANSFER_TO_RACK
  - ReferenceDoc: TransferNo
  - BalanceBefore: current_rack_qty
  - QtyIn: transfer_qty
  - QtyOut: 0
  - BalanceAfter: BalanceBefore + QtyIn
  - CreatedBy: username
```

---

## Inventory Ledger Pattern

**IMPORTANT:** `InventoryLedger` adalah SATU-SATUNYA source of truth untuk stok.

| Field | Description |
|-------|-------------|
| `BalanceBefore` | Saldo sebelum transaksi |
| `QtyIn` | Jumlah masuk |
| `QtyOut` | Jumlah keluar |
| `BalanceAfter` | Saldo setelah transaksi = `BalanceBefore + QtyIn - QtyOut` |

**Cache Fields (Material table):**
- `Material.QtyRack` - Cache stok di rak
- `Material.QtyWarehouse` - Cache stok di warehouse

**Formula:**
```
BalanceAfter = BalanceBefore + QtyIn - QtyOut
```

---

## Data Models - Material Flow

### Database Tables

```
┌─────────────────┐     ┌─────────────────┐
│    Material     │     │    Incoming     │
├─────────────────┤     ├─────────────────┤
│ Id (PK)         │◀────│ IncomingId (FK) │
│ PartNumber      │     │ IncomingNo      │
│ PartName        │     │ IncomingDate    │
│ QtyRack         │     │ Status          │
│ QtyWarehouse    │     │ SupplierId (FK) │
│ RackLocation    │     │ SupplierDocNo   │
│ SatuanId (FK)   │     │ CreatedBy      │
│ CreatedBy       │     │ CreatedAt      │
└─────────────────┘     └─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐     ┌─────────────────┐
│  IncomingItem   │     │MaterialTransfer │
├─────────────────┤     ├─────────────────┤
│ Id (PK)         │     │ TransferId (PK) │
│ IncomingId (FK) │     │ TransferNo      │
│ MaterialId (FK) │◀───▶│ TransferType    │
│ QtyReceived     │     │ Status          │
│ QtyRejected     │     │ SourceLocation  │
│ Sat
```

**Full Content:**


---

# ============================================================================
# 2. PRODUCTION FLOW (Forecast to Delivery)
# ============================================================================

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           PRODUCTION FLOW                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐                                                         │
│  │ IMPORT FORECAST │  Step 1: Upload Excel/CVS dengan data forecast            │
│  │  (Excel/CSV)    │      - Customer, PartNumber, Qty, DeliveryDate          │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ GENERATE        │  Step 2: Generate Production Release                     │
│  │ PRODUCTION      │      - Pilih Forecast yang akan diproses                │
│  │ RELEASE         │      - System auto-generate Production Plan              │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ SHOPPING/       │  Step 3: Create Shopping List                           │
│  │ PICKING LIST    │      - System kalkulasi material needed (BOM)            │
│  │                 │      - Generate Picking Instructions                    │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ STOCK OUT       │  Step 4: Ambil material dari Rack                       │
│  │ FROM RACK       │      - Scan material                                     │
│  │                 │      - Kurangi QtyRack di Inventory Ledger              │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ STOCK IN        │  Step 5: Material masuk area produksi                    │
│  │ FINISH GOOD     │      - Tambah QtyFinishGood                             │
│  │ AREA            │                                                         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ PRODUCTION /   │  Step 6: Proses Assembling                               │
│  │ ASSEMBLING     │      - Operator bekerja sesuai SOP                        │
│  │                 │                                                         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ PRE FINISH      │  Step 7: Semi-finished goods                            │
│  │ GOOD            │      - Barang menunggu QC check                          │
│  │                 │                                                         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ SCAN POKAYOKE   │  Step 8: QC Check (Error Proofing)                       │
│  │ (QC CHECK)      │      - Scan barcode/part number                          │
│  │                 │      - System compare vs expected                         │
│  └────────┬────────┘      - Result: SUKSES / GAGAL                            │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ READY TO        │  Step 9: Barang siap kirim                              │
│  │ DELIVERY        │      - Status: READY                                     │
│  │                 │      - Menunggu scheduled delivery date                  │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ SCAN DELIVERY   │  Step 10: Scan saat barang dikirim                       │
│  │ (OUTBOUND)       │      - Record delivery timestamp                        │
│  │                 │      - Link ke Delivery Note                             │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ STOCK OUT       │  Step 11: Kurangi Finish Good stock                     │
│  │ FINISH GOOD     │      - QtyFinishGood -= delivered_qty                    │
│  │                 │                                                         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ CLOSE PLAN      │  Step 12: If ALL Forecast Delivered                      │
│  │ (IF COMPLETE)   │      - ProductionPlan.Status = COMPLETED                 │
│  │                 │      - Final report generated                           │
│  └─────────────────┘                                                         │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Detail

### Step 1: Import Production Forecast
**Endpoint:** `POST /production/forecast/import`
**Actors:** Production Planner
**Permission:** `FORECAST_CREATE`

**Input:** Excel/CSV file dengan columns:
- `CustomerName` - Nama customer
- `PartNumber` - Part number Finish Good
- `Qty` - Jumlah yang dipesan
- `DeliveryDate` - Tanggal pengiriman yang dijadwalkan

**Data Created:**
```
ProductionForecast:
  - ForecastId: auto-generated
  - CustomerName: from import
  - PartNumber: from import
  - Qty: from import
  - DeliveryDate: from import
  - Status: PENDING
  - ImportedBy: username
  - ImportedAt: current timestamp
```

**Process:**
1. Upload Excel/CSV file
2. System parse dan validate data
3. System create ProductionForecast records
4. System return import summary (total, success, failed)

---

### Step 2: Generate Production Release
**Endpoint:** `POST /production/production-release`
**Actors:** Production Manager
**Permission:** `PRODUCTION_CREATE`

**Input:**
- `PlanDate` - Tanggal rencana produksi
- `ForecastIds[]` - Array ID forecast yang mau diproses
- `Notes` - Catatan (optional)

**Data Created:**
```
ProductionPlan:
  - PlanId: auto-generated (PP-YYYYMMDD-XXXX)
  - PlanDate: from input
  - Status: RELEASED
  - TotalForecastCount: count of selected forecasts
  - CreatedBy: username
  - ReleasedBy: username
  - ReleasedAt: current timestamp

ProductionPlanItem:
  - ForecastId: from selected forecasts
  - PlanId: FK to ProductionPlan
  - Status: PENDING
```

**Process:**
1. Select forecasts dari list (checkbox/selection)
2. System auto-generate ProductionPlan
3. System auto-generate ProductionPlanItems dari selected forecasts
4. System trigger Shopping List generation

**Validation Rules:**
- [ ] Forecast harus berstatus PENDING
- [ ] Forecast tidak boleh duplicate dalam 1 plan
- [ ] PlanDate harus valid

---

### Step 3: Generate Shopping/Picking List
**Endpoint:** `POST /production/shopping`
**Actors:** System (Automated after Release) / Warehouse Staff
**Permission:** `SHOPPING_CREATE`

**Input:**
- `PlanId` - ID Production Plan

**Data Created:**
```
ShoppingList:
  - ListId: auto-generated
  - PlanId: FK to ProductionPlan
  - Status: PENDING
  - CreatedBy: username

ShoppingListItem:
  - MaterialId: calculated from BOM
  - QtyNeeded: calculated from Forecast * BOM.Qty
  - QtyPicked: 0
  - RackLocation: from Material.RackLocation
  - Status: PENDING
```

**BOM Calculation:**
```typescript
For each ProductionPlanItem:
  Get FinishGood.PartNumber
  Get BillOfMaterials[FinishGoodId]

  For each BOMItem:
    TotalMaterialNeeded = PlanItem.Qty * BOMItem.QtyPerUnit

    Add to ShoppingListItem:
      MaterialId: BOMItem.MaterialId
      QtyNeeded: TotalMaterialNeeded
```

---

### Step 4: Picking Material from Rack
**Actors:** Warehouse Staff
**Permission:** `SHOPPING_UPDATE`

**Process:**
1. Staff menerima Picking List (print/screen)
2. Staff pergi ke lokasi rack sesuai list
3. Staff scan material dan input qty actual
4. System update ShoppingListItem:
   ```
   QtyPicked += actual_qty
   Status = PICKED if QtyPicked >= QtyNeeded
   ```

**Validation:**
- [ ] QtyPicked tidak boleh > QtyNeeded (warn if exceeded)
- [ ] Material harus sesuai PartNumber
- [ ] Staff harus scan barcode untuk Poka-Yoke

---

### Step 5: Stock Out from Rack
**Endpoint:** `PATCH /production/shopping/:id/stock-out`
**Actors:** System (Automated after Picking)
**Permission:** `SHOPPING_UPDATE`

**Process:**
1. System validate all items picked
2. System create InventoryLedger entries:

```
InventoryLedger:
  - Id: UUID
  - ItemCategory: MATERIAL
  - MaterialId: String(materialId)
  - LocationType: RACK
  - TransactionType: PRODUCTION_USAGE
  - ReferenceDoc: ShoppingListNo
  - BalanceBefore: current_rack_qty
  - QtyIn: 0
  - QtyOut: picked_qty
  - BalanceAfter: BalanceBefore - QtyOut
  - CreatedBy: SYSTEM
```

3. System update Material cache:
```typescript
Material.QtyRack -= picked_qty
```

4. Update ShoppingList status: IN_PROGRESS

---

### Step 6: Stock In to Finish Good Area
**Endpoint:** `PATCH /production/shopping/:id/stock-in-production`
**Actors:** Production Staff
**Permission:** `SHOPPING_UPDATE`

**Process:**
1. Material arrives at production area
2. Staff confirm receipt
3. System create InventoryLedger entry:

```
InventoryLedger:
  - Id: UUID
  - ItemCategory: MATERIAL
  - MaterialId: String(materialId)
  - LocationType: FINISH_GOOD_AREA (temporary)
  - TransactionType: PRODUCTION_USAGE
  - ReferenceDoc: ShoppingListNo
  - BalanceBefore: 0
  - QtyIn: received_qty
  - QtyOut: 0
  - BalanceAfter: received_qty
  - CreatedBy: username
```

---

### Step 7: Production / Assembling Process
**Actors:** Production Operator
**Permission:** `PRODUCTION_UPDATE`

**Process:**
1. Operator mengambil material dari Finish Good Area
2. Operator melakukan assembling sesuai SOP
3. Operator membuat semi-finished goods (Pre Finish Good)
4. System track progress via ProductionReport

```
ProductionReport:
  - ReportId: auto-generated
  - PlanId: FK
  - OperatorId: FK to ManPower
  - QtyProduced: number
  - QtyNG: number (if any)
  - StartTime: timestamp
  - EndTime: timestamp
  - Status: IN_PROGRESS / COMPLETED
```

---

### Step 8: Pre Finish Good
**Actors:** Production Staff
**Permission:** `PRODUCTION_UPDATE`

**Process:**
1. Assembled goods moved to Pre-FG area
2. Goods waiting for QC/Pokayoke check
3. System record:

```
ProductionReport.Status = PRE_FINISH_GOOD
```

---

### Step 9: Scan Pokayoke (QC Check)
**Endpoint:** `POST /production/pokayoke`
**Actors:** QC Inspector
**Permission:** `POKAYOKE_CREATE`

**Input:**
- `PlanId` - ID Production Plan
- `PartNumber` - Scanned part number
- `Result` - SUKSES / GAGAL
- `Notes` - Catatan (jika GAGAL)

**Pokayoke Validation:**
```typescript
// System auto-compare scanned vs expected
ExpectedPartNumber = GetFinishGoodFromPlan(PlanId)

if (ScannedPartNumber == ExpectedPartNumber) {
  Result = 'SUKSES'
} else {
  Result = 'GAGAL'
  // Trigger alert / rework
}
```

**Data Created:**
```
PokayokeCheck:
  - CheckId: auto-generated
  - PlanId: FK
  - ScannedPartNumber: from scan
  - ExpectedPartNumber: from plan
  - Result: SUKSES / GAGAL
  - CheckedBy: username
  - CheckedAt: timestamp
  - Notes: notes if GAGAL
```

**Flow After Check:**
```
If Result = SUKSES:
  → Move to Ready To Delivery

If Result = GAGAL:
  → NG_SCRAP entry
  → Alert supervisor
  → Wait for rework decision
```

---

### Step 10: Ready To Delivery
**Actors:** System (Automated after Pokayoke)
**Permission:** `PRODUCTION_UPDATE`

**Process:**
1. System update ProductionPlanItem status:
```
ProductionPlanItem.Status = READY_TO_DELIVER
```

2. System record in ProductionReport:
```
ProductionReport.QtyPassed = QtyProduced - QtyNG
```

3. Goods moved to Delivery staging area

---

### Step 11: Scan Delivery (Outbound)
**Endpoint:** `POST /production/delivery`
**Actors:** Warehouse Staff / Delivery Personnel
**Permission:** `DELIVERY_CREATE`

**Input:**
- `PlanId` - ID Production Plan
- `DeliveryNo` - No. Surat Jalan
- `Items[]`:
  - `FinishGoodId` - ID Finish Good
  - `QtyDelivered` - Jumlah dikirim

**Data Created:**
```
Delivery:
  - DeliveryId: auto-generated
  - DeliveryNo: from input
  - DeliveryDate: current date
  - PlanId: FK
  - Status: SHIPPED
  - CreatedBy: username

DeliveryItem:
  - FinishGoodId: from input
  - QtyDelivered: from input
  - Status: DELIVERED
```

---

### Step 12: Stock Out Finish Good
**Endpoint:** `PATCH /production/delivery/:id/stock-out`
**Actors:** System (Automated)
**Permission:** `DELIVERY_UPDATE`

**Process:**
1. System validate delivery
2. System create InventoryLedger entries:

```
InventoryLedger:
  - Id: UUID
  - ItemCategory: FINISH_GOOD
  - FinishGoodId: String(finishGoodId)
  - LocationType: FINISH_GOOD_AREA
  - TransactionType: DELIVERY_TO_CUSTOMER
  - ReferenceDoc: DeliveryNo
  - BalanceBefore: current_fg_qty
  - QtyIn: 0
  - QtyOut: delivered_qty
  - BalanceAfter: BalanceBefore - QtyOut
  - CreatedBy: SYSTEM
```

3. System update FinishGood cache:
```typescript
FinishGood.Qty -= delivered_qty
```

---

### Step 13: Close Production Plan
**Endpoint:** `PATCH /production/production-release/:id/close`
**Actors:** Production Manager
**Permission:** `PRODUCTION_UPDATE`

**Process:**
1. System check if ALL forecasts delivered:
```typescript
const planItems = await GetPlanItems(planId)
const allDelivered = planItems.every(
  item => item.Status === 'DELIVERED'
)

if (allDelivered) {
  // Close the plan
  ProductionPlan.Status = COMPLETED
  ProductionPlan.CompletedAt = now
} else {
  // Partial delivery - keep as IN_PROGRESS
  // Allow remaining items to be delivered later
}
```

**Validation Rules:**
- [ ] ALL ProductionPlanItems must be DELIVERED
- [ ] No pending NG items without resolution
- [ ] All ShoppingList must be COMPLETED

---

## Data Models - Production Flow

### Database Tables

```
┌─────────────────────┐
│ ProductionForecast │
├─────────────────────┤
│ ForecastId (PK)    │
│ CustomerName       │
│ PartNumber         │
│ Qty                │
│ DeliveryDate       │
│ Status             │
│ ImportedBy         │
│ ImportedAt         │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│  ProductionPlan     │────▶│ ProductionPlanItem │
├─────────────────────┤     ├─────────────────────┤
│ PlanId (PK)         │1:N  │ PlanItemId (PK)    │
│ PlanNo              │     │ PlanId (FK)        │
│ PlanDate            │     │ ForecastId (FK)    │
│ Status              │     │ Status             │
│ TotalForecastCount │     │ QtyProduced        │
│ CreatedBy          │     │ QtyDelivered       │
│ ReleasedBy          │     │ QtyNG              │
│ CompletedAt         │     └─────────────────────┘
└─────────────────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│   ShoppingList      │────▶│ ShoppingListItem   │
├─────────────────────┤     ├─────────────────────┤
│ ListId (PK)         │1:N  │ ListItemId (PK)    │
│ ListNo              │     │ ListId (FK)        │
│ PlanId (FK)         │     │ MaterialId (FK)    │
│ Status              │     │ QtyNeeded          │
│ CreatedBy          │     │ QtyPicked          │
└─────────────────────┘     │ RackLocation       │
                            └─────────────────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│  ProductionReport  │────▶│ ProductionReportDet│
├─────────────────────┤     ├─────────────────────┤
│ ReportId (PK)      │1:N  │ DetailId (PK)      │
│ PlanId (FK)        │     │ ReportId (FK)      │
│ OperatorId (FK)    │     │ FinishGoodId (FK)  │
│ QtyProduced        │     │ QtyProduced        │
│ QtyNG              │     │ QtyNG              │
│ StartTime          │     │ Status             │
│ EndTime            │     └─────────────────────┘
│ Status             │
└─────────────────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐     ┌─────────────────────┐
│   Delivery          │────▶│ DeliveryItem       │
├─────────────────────┤     ├─────────────────────┤
│ DeliveryId (PK)     │1:N  │ ItemId (PK)        │
│ DeliveryNo          │     │ DeliveryId (FK)    │
│ DeliveryDate        │     │ FinishGoodId (FK)  │
│ PlanId (FK)         │     │ QtyDelivered       │
│ Status              │     └─────────────────────┘
│ CreatedBy           │
└─────────────────────┘
```

### Finish Good & BOM

```
┌─────────────────────┐
│   FinishGood        │
├─────────────────────┤
│ FGId (PK)          │
│ PartNumber         │
│ PartName           │
│ Qty                │
│ RackLocation       │
│ CreatedBy          │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│ BillOfMaterials    │
├─────────────────────┤
│ BOMId (PK)         │
│ FinishGoodId (FK)  │
│ MaterialId (FK)    │
│ QtyPerUnit         │
│ CreatedBy          │
└─────────────────────┘
```

---



---

# ============================================================================
# 3. STOCK OPNAME FLOW (Inventory Counting)
# ============================================================================

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           STOCK OPNAME FLOW                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐                                                         │
│  │ GENERATE        │  Step 1: Buat Aktivitas Stock Opname                   │
│  │ STOCK OPNAME    │      - Tentukan periode, lokasi, jenis item            │
│  │ ACTIVITY        │      - System generate Opname record                    │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ DOWNLOAD        │  Step 2: Export data untuk counting                      │
│  │ SNAPSHOT STOCK  │      - Download Excel worksheet                          │
│  │ & WORKSHEET     │      - Include: PartNumber, Location, SystemQty         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ COUNTING        │  Step 3: Staff melakukan penghitungan                    │
│  │ PHYSICAL STOCK  │      - Staff pergi ke lokasi                            │
│  │                 │      - Hitung qty fisik di setiap location               │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ SUBMIT RESULTS  │  Step 4: Input hasil counting                           │
│  │ (Counting vs    │      - Upload Excel atau input satu per satu           │
│  │  System)        │      - System auto-calculate variance                    │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ VALIDATE &      │  Step 5: Supervisor review & approve                     │
│  │ APPROVE         │      - Bandingkan hasil counting                         │
│  │                 │      - Investigasi variance yang besar                  │
│  └────────┬────────┘      - Approve untuk adjustment                          │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ SYSTEM ADJUSTS  │  Step 6: System menyesuaikan stok                       │
│  │ STOCK           │      - Buat ledger entries untuk adjustment              │
│  │                 │      - Update cache qty di Material/FinishGood         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ CLOSE OPNAME    │  Step 7: Tutup periode opname                           │
│  │                 │      - Generate report                                  │
│  │                 │      - Archive data                                      │
│  └─────────────────┘                                                         │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Detail

### Step 1: Generate Stock Opname Activity
**Endpoint:** `POST /inventory-counting`
**Actors:** Warehouse Supervisor
**Permission:** `INVENTORY_COUNTING_CREATE`

**Input:**
- `OpnameName` - Nama aktivitas (e.g., "Opname Juni 2026")
- `OpnameDate` - Tanggal opname
- `LocationType` - WAREHOUSE / RACK / FINISH_GOOD_AREA / ALL
- `ItemCategory` - MATERIAL / FINISH_GOOD / ALL
- `AssignedTo[]` - Array user yang assigned untuk counting
- `Deadline` - Batas waktu selesai counting

**Data Created:**
```
StockOpname:
  - OpnameId: UUID
  - OpnameNo: auto-generated (OPN-YYYYMMDD-XXXX)
  - OpnameName: from input
  - OpnameDate: from input
  - LocationType: from input
  - ItemCategory: from input
  - Status: DRAFT
  - AssignedTo: from input
  - Deadline: from input
  - CreatedBy: username
  - CreatedAt: timestamp

StockOpnameItem:
  - For each Material/FinishGood matching criteria:
    - ItemId: UUID
    - OpnameId: FK
    - MaterialId / FinishGoodId: FK
    - SystemQty: current stock from ledger
    - PhysicalQty: null (pending count)
    - Variance: null (pending count)
    - Status: PENDING
```

**Validation Rules:**
- [ ] Tidak boleh ada opname aktif untuk lokasi yang sama
- [ ] Deadline harus > OpnameDate
- [ ] Minimal 1 item untuk di-opname

---

### Step 2: Download Snapshot Stock & Worksheet
**Endpoint:** `GET /inventory-counting/:id/worksheet`
**Actors:** Warehouse Staff / Supervisor
**Permission:** `INVENTORY_COUNTING_READ`

**Output:** Excel file dengan columns:
- `No` - Urutan
- `PartNumber` - Part number item
- `PartName` - Nama item
- `Location` - Lokasi rak/gudang
- `SystemQty` - Qty di sistem (from ledger)
- `PhysicalQty` - Qty fisik (blank, untuk diisi)
- `Variance` - Selisih (blank, auto-calc)
- `Notes` - Catatan jika ada

**Worksheet Template:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKSHEET STOCK OPNAME                               │
│  Opname No: OPN-20260618-0001                                               │
│  Tanggal: 18 Juni 2026                                                      │
│  Lokasi: RACK                                                              │
├─────┬────────────┬────────────────────┬─────────────┬─────────────┬───────┤
│ No  │ PartNumber │ PartName           │ SystemQty   │ PhysicalQty │ Notes │
├─────┼────────────┼────────────────────┼─────────────┼─────────────┼───────┤
│ 1   │ MAT-001    │ Screw M3x10        │ 500         │             │       │
│ 2   │ MAT-002    │ Bearing 6204ZZ     │ 200         │             │       │
│ 3   │ FG-001     │ Assembly Unit A    │ 50          │             │       │
└─────┴────────────┴────────────────────┴─────────────┴─────────────┴───────┘
```

---

### Step 3: Counting Physical Stock
**Actors:** Assigned Warehouse Staff
**Permission:** `INVENTORY_COUNTING_UPDATE`

**Process:**
1. Staff menerima worksheet print-out
2. Staff pergi ke setiap lokasi sesuai worksheet
3. Staff menghitung qty fisik dari setiap item
4. Staff mencatat hasil di kolom PhysicalQty
5. Staff签字 di worksheet

**Physical Counting Rules:**
- [ ] Item harus dihitung di lokasi yang tertulis
- [ ] Staff harus menggunakan satuan yang sama dengan sistem
- [ ] Jika ada discrepancy, catat di kolom Notes
- [ ] Jika item tidak ditemukan, catat qty = 0

---

### Step 4: Submit Counting Results
**Endpoint:** `PATCH /inventory-counting/:id/submit`
**Actors:** Warehouse Staff
**Permission:** `INVENTORY_COUNTING_UPDATE`

**Input:**
- `Items[]` - Array hasil counting:
  - `ItemId` - ID dari StockOpnameItem
  - `PhysicalQty` - Qty hasil penghitungan
  - `Notes` - Catatan (optional)

**Process:**
1. Staff upload hasil counting (Excel atau input manual)
2. System calculate variance:
```typescript
Variance = PhysicalQty - SystemQty
VariancePercentage = (Variance / SystemQty) * 100
```

3. System update StockOpnameItem:
```
PhysicalQty: from input
Variance: calculated
Status: PENDING_REVIEW (if variance != 0)
       COMPLETED (if variance == 0)
```

4. System update StockOpname:
```
Status: IN_PROGRESS
CountedBy: username
CountedAt: timestamp
```

**Variance Classification:**
```
| Variance %  | Classification | Action                    |
|-------------|----------------|---------------------------|
| 0%          | MATCH          | Auto-approve              |
| 0.1% - 5%   | MINOR          | Supervisor review         |
| > 5%        | MAJOR          | Manager approval + Investigasi |
```

---

### Step 5: Validate & Approve Results
**Endpoint:** `PATCH /inventory-counting/:id/approve`
**Actors:** Warehouse Supervisor / Manager
**Permission:** `INVENTORY_COUNTING_UPDATE`

**Process:**
1. Supervisor review hasil counting
2. Supervisor investigate variance yang mencurigakan:
   - Cek apakah ada transaksi yang terlewat
   - Cek apakah ada damage/expired goods
   - Cek apakah ada misplaced items

3. Supervisor approve/reject each item:
```
Status: APPROVED (if variance acceptable)
       REJECTED (need recount)
```

4. Supervisor approve opname:
```
StockOpname.Status = APPROVED
ApprovedBy: username
ApprovedAt: timestamp
```

**Approval Rules:**
```
| Variance Classification | Minimum Approval Level |
|-------------------------|------------------------|
| MATCH (0%)              | Staff (auto)           |
| MINOR (0.1% - 5%)       | Supervisor             |
| MAJOR (> 5%)            | Manager                |
```

---

### Step 6: System Adjusts Stock
**Endpoint:** `PATCH /inventory-counting/:id/adjust`
**Actors:** System (Automated after Approval)
**Permission:** `INVENTORY_COUNTING_UPDATE`

**Process:**
1. System batch process all approved items
2. For each item with variance:

**If PhysicalQty < SystemQty (Stock OUT):**
```
InventoryLedger:
  - Id: UUID
  - ItemCategory: MATERIAL / FINISH_GOOD
  - MaterialId / FinishGoodId: String(itemId)
  - LocationType: from opname
  - TransactionType: STOCK_OPNAME_DIFF
  - ReferenceDoc: OpnameNo
  - BalanceBefore: SystemQty
  - QtyIn: 0
  - QtyOut: Math.abs(Variance)
  - BalanceAfter: PhysicalQty
  - CreatedBy: SYSTEM
  - Notes: "Stock Opname Adjustment"
```

**If PhysicalQty > SystemQty (Stock IN):**
```
InventoryLedger:
  - Id: UUID
  - ItemCategory: MATERIAL / FINISH_GOOD
  - MaterialId / FinishGoodId: String(itemId)
  - LocationType: from opname
  - TransactionType: STOCK_OPNAME_DIFF
  - ReferenceDoc: OpnameNo
  - BalanceBefore: SystemQty
  - QtyIn: Math.abs(Variance)
  - QtyOut: 0
  - BalanceAfter: PhysicalQty
  - CreatedBy: SYSTEM
  - Notes: "Stock Opname Adjustment"
```

3. System update Material/FinishGood cache:
```typescript
// For Material
Material.QtyRack = PhysicalQty (for RACK location)
Material.QtyWarehouse = PhysicalQty (for WAREHOUSE location)

// For FinishGood
FinishGood.Qty = PhysicalQty
```

4. System update StockOpname:
```
Status: COMPLETED
AdjustmentCompletedAt: timestamp
```

---

### Step 7: Close Opname Activity
**Endpoint:** `PATCH /inventory-counting/:id/close`
**Actors:** Warehouse Supervisor
**Permission:** `INVENTORY_COUNTING_UPDATE`

**Process:**
1. Validate all items have been adjusted
2. Generate Opname Report:
```
StockOpnameReport:
  - OpnameNo: from StockOpname
  - TotalItems: count of all items
  - MatchItems: count where PhysicalQty == SystemQty
  - MinorVariance: count where variance 0.1% - 5%
  - MajorVariance: count where variance > 5%
  - TotalStockValue: calculated from system
  - AdjustedValue: calculated after adjustment
  - GeneratedBy: username
  - GeneratedAt: timestamp
```

3. Archive StockOpname data:
```
StockOpname.Status = ARCHIVED
ArchivedAt: timestamp
```

**Report Summary Example:**
```
┌────────────────────────────────────────────────────────────────────┐
│                    STOCK OPNAME REPORT                              │
├────────────────────────────────────────────────────────────────────┤
│ Opname No       : OPN-20260618-0001                                 │
│ Tanggal         : 18 Juni 2026                                      │
│ Lokasi          : RACK                                              │
├────────────────────────────────────────────────────────────────────┤
│ SUMMARY                                                             │
│ Total Items     : 150                                                │
│ Match (0%)      : 140 items (93.3%)                                 │
│ Minor Var (<5%) : 8 items (5.3%)                                    │
│ Major Var (>5%) : 2 items (1.3%)                                    │
├────────────────────────────────────────────────────────────────────┤
│ VARIANCE DETAILS                                                     │
│ ┌──────────┬────────────┬──────────┬──────────┬───────────────┐  │
│ │ PartNo   │ SystemQty  │ Physical │ Variance │ %             │  │
│ ├──────────┼────────────┼──────────┼──────────┼───────────────┤  │
│ │ MAT-045  │ 100        │ 95       │ -5       │ -5.0%         │  │
│ │ FG-012   │ 50         │ 48       │ -2       │ -4.0%         │  │
│ └──────────┴────────────┴──────────┴──────────┴───────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## Data Models - Stock Opname Flow

### Database Tables

```
┌─────────────────────┐
│    StockOpname      │
├─────────────────────┤
│ OpnameId (PK)      │
│ OpnameNo           │
│ OpnameName         │
│ OpnameDate         │
│ LocationType       │
│ ItemCategory       │
│ Status             │
│ AssignedTo[]       │
│ Deadline           │
│ CountedBy          │
│ CountedAt          │
│ ApprovedBy         │
│ ApprovedAt         │
│ AdjustmentBy       │
│ AdjustmentAt       │
│ ArchivedAt         │
│ CreatedBy          │
│ CreatedAt          │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│  StockOpnameItem   │
├─────────────────────┤
│ ItemId (PK)        │
│ OpnameId (FK)     │
│ MaterialId (FK)    │ (nullable - if ItemCategory = FINISH_GOOD)
│ FinishGoodId (FK)  │ (nullable - if ItemCategory = MATERIAL)
│ Location           │
│ SystemQty          │
│ PhysicalQty        │
│ Variance           │
│ VariancePercent    │
│ Notes              │
│ Status             │ PENDING, IN_PROGRESS, APPROVED, REJECTED
│ AdjustmentType     │ STOCK_IN, STOCK_OUT, NONE
└─────────────────────┘
```

### Opname Status Flow

```
┌─────────┐     ┌─────────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│  DRAFT  │────▶│ IN_PROGRESS │────▶│ APPROVED  │────▶│ COMPLETED │────▶│ ARCHIVED  │
└─────────┘     └─────────────┘     └───────────┘     └───────────┘     └───────────┘
                      │                   │
                      │                   │
                      ▼                   ▼
                ┌───────────┐       ┌───────────┐
                │ REJECTED  │       │  CLOSED   │
                │ (Recount) │       │           │
                └───────────┘       └───────────┘
```

### Inventory Ledger Entry (Opname Adjustment)

```
TransactionType: STOCK_OPNAME_DIFF
ReferenceDoc: OpnameNo (e.g., OPN-20260618-0001)

For STOCK OUT (Physical < System):
  QtyIn = 0
  QtyOut = abs(Variance)
  BalanceAfter = PhysicalQty

For STOCK IN (Physical > System):
  QtyIn = abs(Variance)
  QtyOut = 0
  BalanceAfter = PhysicalQty
```

---



---

# ============================================================================
# 4. MATERIAL TRANSFER FLOW (To Sprocket)
# ============================================================================

## Flow Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    MATERIAL TRANSFER TO SPROCKET                              │
│                    (Inter-Company Material Request)                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│   │  SPROCKET   │────────▶│   API       │────────▶│  MATERIAL   │           │
│   │  SYSTEM     │ Request │  ANSEI      │ Process │  DELIVERY   │           │
│   │             │         │             │         │  NOTE (DN)  │           │
│   └─────────────┘         └─────────────┘         └──────┬──────┘           │
│                                                          │                   │
│                                                          │ Generate          │
│                                                          ▼                   │
│   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│   │  SPROCKET   │◀────────│   API       │◀────────│  PICKING    │           │
│   │  SYSTEM     │ Status  │  ANSEI      │ Confirm │  INSTRUCTION│          │
│   │  (GR)       │ Receive │             │         │             │           │
│   └─────────────┘         └─────────────┘         └─────────────┘           │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Flow Diagram (Step-by-Step)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DETAILED FLOW                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐                                                         │
│  │ 1. SPROCKET      │  External System (Sprocket) sends material request   │
│  │ SENDS REQUEST    │  via API                                               │
│  │ VIA API          │                                                         │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 2. CREATE        │  System creates Material Delivery Order                │
│  │ DELIVERY ORDER   │  - Convert request to picking work order              │
│  │                  │  - Generate Delivery Number                            │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 3. PICKING       │  Warehouse Staff receives work order                  │
│  │ INSTRUCTION      │  - Prepare materials from rack                         │
│  │ GENERATED        │  - Materials collected for delivery                    │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 4. MATERIALS     │  Staff picks materials based on delivery order       │
│  │ PICKED           │  - Scan/verify each material                          │
│  │                  │  - Check quantities                                    │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 5. PRINT         │  Generate Delivery Note (Surat Jalan)                │
│  │ DELIVERY NOTE    │  - Document for shipment                               │
│  │ (DN)             │  - Include all items with quantities                 │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 6. APPROVE       │  Supervisor/Manager approves the delivery              │
│  │ SHIPMENT         │  - Final verification                                 │
│  │                  │  - Authorization to release                           │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 7. STOCK OUT     │  System decreases warehouse stock                      │
│  │ FROM WAREHOUSE   │  - Create Inventory Ledger entry                      │
│  │                  │  - Update Material.QtyWarehouse                       │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 8. SHIP TO       │  Materials physically shipped to Sprocket              │
│  │ SPROCKET         │  - Delivery with Surat Jalan                          │
│  │                  │  - Await GR confirmation                              │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 9. GR AT         │  Sprocket receives materials                          │
│  │ SPROCKET         │  - Goods Receipt at Sprocket system                   │
│  │                  │  - Sprocket validates received qty                      │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 10. SPROCKET     │  Sprocket sends received status via API              │
│  │ SENDS STATUS     │  - Confirms quantities received                       │
│  │ VIA API          │  - Reports any discrepancy                            │
│  └────────┬────────┘                                                         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────┐                                                         │
│  │ 11. MARK AS      │  System updates delivery status                        │
│  │ RECEIVED         │  - Status = RECEIVED                                 │
│  │                  │  - Record GR details from Sprocket                    │
│  └─────────────────┘                                                         │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Detail

### Step 1: Sprocket Sends Material Request via API
**External API Endpoint:** `POST /external/material-request`
**Source:** Sprocket System
**Auth:** API Key / Service Account

**Request Body:**
```json
{
  "RequestNo": "REQ-SPR-20260618-001",
  "RequestDate": "2026-06-18",
  "RequestedBy": "Sprocket System",
  "Items": [
    {
      "MaterialCode": "MAT-001",
      "PartNumber": "SCREW-M3X10-SS",
      "Description": "Screw M3x10 Stainless",
      "QtyRequested": 1000,
      "Satuan": "PCS",
      "RequiredDate": "2026-06-20",
      "Notes": "Urgent - Production need"
    },
    {
      "MaterialCode": "MAT-002",
      "PartNumber": "BEARING-6204ZZ",
      "Description": "Bearing 6204ZZ",
      "QtyRequested": 50,
      "Satuan": "PCS",
      "RequiredDate": "2026-06-20",
      "Notes": null
    }
  ],
  "DeliveryAddress": "PT Sprocket Indonesia, Industrial Park...",
  "PIC": "John Doe",
  "ReferenceDoc": "PO-SPR-2024-0123"
}
```

**Validation:**
- [ ] API Key must be valid
- [ ] RequestNo must be unique
- [ ] All MaterialCode must exist in ANSEI master
- [ ] QtyRequested must be positive

**Data Created:**
```
MaterialDeliveryRequest:
  - RequestId: UUID
  - RequestNo: from input (e.g., REQ-SPR-20260618-001)
  - RequestDate: from input
  - SourceSystem: SPROCKET
  - Status: PENDING
  - ReferenceDoc: from input (PO number)
  - DeliveryAddress: from input
  - PIC: from input
  - CreatedAt: timestamp
  - ReceivedAt: timestamp

MaterialDeliveryRequestItem:
  - ItemId: UUID
  - RequestId: FK
  - MaterialId: FK (mapped from MaterialCode)
  - PartNumber: from input
  - QtyRequested: from input
  - QtyApproved: null
  - QtyShipped: null
  - Status: PENDING
```

---

### Step 2: System Creates Picking Work Order
**Actors:** System (Automated after Request received)
**Permission:** `MATERIAL_DELIVERY_CREATE`

**Process:**
1. System converts request to picking work order
2. System checks material availability:
```typescript
For each RequestItem:
  AvailableQty = Material.QtyWarehouse + Material.QtyRack

  if (AvailableQty >= QtyRequested) {
    Item.Status = APPROVED
    QtyApproved = QtyRequested
  } else if (AvailableQty > 0) {
    Item.Status = PARTIAL
    QtyApproved = AvailableQty
    // Alert: Partial fulfillment
  } else {
    Item.Status = BACKORDER
    QtyApproved = 0
    // Alert: Out of stock
  }
```

3. System generates Delivery Order:
```
MaterialDeliveryOrder:
  - OrderId: UUID
  - OrderNo: auto-generated (MDO-YYYYMMDD-XXXX)
  - RequestId: FK
  - Status: PENDING_PICKING
  - CreatedAt: timestamp
  - AssignedTo: warehouse_staff

MaterialDeliveryOrderItem:
  - ItemId: UUID
  - OrderId: FK
  - MaterialId: FK
  - QtyOrdered: from approved qty
  - QtyPicked: 0
  - RackLocation: from Material.RackLocation
  - Status: PENDING
```

4. Notification sent to warehouse staff

---

### Step 3: Picking Instruction Generated
**Endpoint:** `GET /material-delivery-note/:id/picking-list`
**Actors:** Warehouse Staff
**Permission:** `MATERIAL_DELIVERY_READ`

**Output:** Picking List / Work Order
```
┌────────────────────────────────────────────────────────────────────┐
│                    PICKING WORK ORDER                               │
├────────────────────────────────────────────────────────────────────┤
│ Order No    : MDO-20260618-0001                                    │
│ Request No  : REQ-SPR-20260618-001                                  │
│ Request From: SPROCKET                                               │
│ Required Date: 2026-06-20                                           │
├────────────────────────────────────────────────────────────────────┤
│ PIC: Warehouse Staff A                                               │
│ Deadline: 2026-06-19 17:00                                          │
├────────────────────────────────────────────────────────────────────┤
│ NO │ PART NUMBER      │ DESCRIPTION          │ QTY │ RACK │ STATUS   │
├────┼──────────────────┼──────────────────────┼─────┼──────┼──────────┤
│ 1  │ SCREW-M3X10-SS   │ Screw M3x10 SS       │ 1000│ R-01 │ PENDING  │
│ 2  │ BEARING-6204ZZ   │ Bearing 6204ZZ      │ 50  │ R-05 │ PENDING  │
├────────────────────────────────────────────────────────────────────┤
│ Total Items: 2                                                       │
│ Total Qty: 1050 PCS                                                  │
└────────────────────────────────────────────────────────────────────┘
```

---

### Step 4: Materials Picked
**Endpoint:** `PATCH /material-delivery-note/:id/pick`
**Actors:** Warehouse Staff
**Permission:** `MATERIAL_DELIVERY_UPDATE`

**Input:**
```json
{
  "Items": [
    {
      "ItemId": "uuid-1",
      "QtyPicked": 1000,
      "ScannedBarcode": "SCREW-M3X10-SS"
    },
    {
      "ItemId": "uuid-2",
      "QtyPicked": 50,
      "ScannedBarcode": "BEARING-6204ZZ"
    }
  ],
  "PickedBy": "warehouse_staff",
  "PickedAt": "2026-06-18T14:30:00Z"
}
```

**Process:**
1. Staff goes to each rack location
2. Staff scans barcode for verification (Poka-Yoke)
3. System validates scanned barcode matches expected:
```typescript
if (ScannedBarcode != ExpectedPartNumber) {
  // Alert: Wrong material
  throw new Error("Barcode mismatch!")
}
```

4. System updates OrderItem:
```
QtyPicked: from input
Status: PICKED (if QtyPicked == QtyOrdered)
Status: PARTIAL (if QtyPicked < QtyOrdered)
```

5. If all items picked:
```
MaterialDeliveryOrder.Status = READY_FOR_SHIPMENT
```

---

### Step 5: Print Delivery Note (DN)
**Endpoint:** `GET /material-delivery-note/:id/print`
**Actors:** Warehouse Staff / System
**Permission:** `MATERIAL_DELIVERY_READ`

**Output:** Surat Jalan / Delivery Note
```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 SURAT JALAN                                    │
│                                                                               │
│  No: SJ-ANSEI-20260618-0001          Tanggal: 18 Juni 2026                   │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                               │
│  Kepada Yth:                              Dari:                               │
│  PT Sprocket Indonesia                    PT ANSEI Indonesia                  │
│  Industrial Park, Block A                 Warehouse Division                  │
│  Jakarta, 12345                                                                   │
│                                                                               │
│  No. PO: PO-SPR-2024-0123              No. Permintaan: REQ-SPR-20260618-001  │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                               │
│  ┌────┬────────────────────┬──────────────────────┬───────┬────────────────┐   │
│  │ No │ Part Number       │ Deskripsi            │ Qty   │ Satuan        │   │
│  ├────┼────────────────────┼──────────────────────┼───────┼────────────────┤   │
│  │ 1  │ SCREW-M3X10-SS    │ Screw M3x10 SS       │ 1000  │ PCS           │   │
│  │ 2  │ BEARING-6204ZZ    │ Bearing 6204ZZ       │ 50    │ PCS           │   │
│  └────┴────────────────────┴──────────────────────┴───────┴────────────────┘   │
│                                                                               │
│  Total: 2 Items                                                              │
│  Total Qty: 1,050 PCS                                                        │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                               │
│  Catatan:                                                                     │
│  - QC check telah dilakukan sebelum pengiriman                               │
│  - Barang sesuai spesifikasi yang dipesan                                     │
│                                                                               │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                               │
│  Penerima,                                    Pengirim,                        │
│                                                                               │
│                                                                               │
│  (....................)                         (....................)        │
│                                                                               │
│  Tanggal:                          Tanggal: 18 Juni 2026                      │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 6: Approve Shipment
**Endpoint:** `PATCH /material-delivery-note/:id/approve`
**Actors:** Warehouse Supervisor / Manager
**Permission:** `MATERIAL_DELIVERY_UPDATE`

**Validation:**
- [ ] All items have been picked
- [ ] DN has been printed
- [ ] Material quantities match order

**Process:**
1. Supervisor reviews the picking list
2. Supervisor verifies physical goods match DN
3. Supervisor approves:
```
MaterialDeliveryOrder.Status = APPROVED
ApprovedBy: supervisor_username
ApprovedAt: timestamp
```

4. If rejected:
```
MaterialDeliveryOrder.Status = REJECTED
RejectReason: from input
```

---

### Step 7: Stock Out from Warehouse
**Endpoint:** `PATCH /material-delivery-note/:id/stock-out`
**Actors:** System (Automated after Approval)
**Permission:** `MATERIAL_DELIVERY_UPDATE`

**Process:**
1. System validate all items approved
2. System create InventoryLedger entries for each item:

```
InventoryLedger:
  - Id: UUID
  - ItemCategory: MATERIAL
  - MaterialId: String(materialId)
  - LocationType: WAREHOUSE
  - TransactionType: MATERIAL_OUT_DELIVERY
  - ReferenceDoc: DeliveryOrderNo (e.g., MDO-20260618-0001)
  - BalanceBefore: current_qty
  - QtyIn: 0
  - QtyOut: shipped_qty
  - BalanceAfter: BalanceBefore - QtyOut
  - CreatedBy: SYSTEM
  - Notes: "Delivery to Sprocket - SJ: SJ-ANSEI-20260618-0001"
```

3. System update Material cache:
```typescript
Material.QtyWarehouse -= shipped_qty
// OR if from Rack:
Material.QtyRack -= shipped_qty
```

4. System update DeliveryOrder:
```
Status: SHIPPED
ShippedBy: username
ShippedAt: timestamp
```

---

### Step 8: Ship Materials to Sprocket
**Actors:** Logistics / Warehouse Staff
**Permission:** `MATERIAL_DELIVERY_UPDATE`

**Process:**
1. Materials loaded for delivery
2. DN handed to driver/courier
3. Materials shipped to Sprocket address
4. Tracking initiated (if applicable)

---

### Step 9: Goods Receipt at Sprocket
**Actors:** Sprocket Warehouse Staff (External)

**Process:**
1. Sprocket receives delivery
2. Sprocket verifies DN against physical goods
3. Sprocket performs GR (Goods Receipt) in their system
4. Sprocket identifies any discrepancies:
   - Over-delivery
   - Under-delivery
   - Damaged goods
   - Wrong items

---

### Step 10: Sprocket Sends Received Status via API
**External API Endpoint:** `POST /external/material-request/:requestNo/status`
**Source:** Sprocket System
**Auth:** API Key / Service Account

**Request Body:**
```json
{
  "RequestNo": "REQ-SPR-20260618-001",
  "GRNumber": "GR-SPR-20260618-001",
  "GRDate": "2026-06-19",
  "Status": "RECEIVED",
  "ReceivedItems": [
    {
      "MaterialCode": "MAT-001",
      "PartNumber": "SCREW-M3X10-SS",
      "QtyOrdered": 1000,
      "QtyReceived": 1000,
      "Condition": "GOOD",
      "Notes": null
    },
    {
      "MaterialCode": "MAT-002",
      "PartNumber": "BEARING-6204ZZ",
      "QtyOrdered": 50,
      "QtyReceived": 48,
      "Condition": "PARTIAL",
      "Notes": "Short received - 2 pcs damaged in transit"
    }
  ],
  "DiscrepancyReport": [
    {
      "MaterialCode": "MAT-002",
      "DiscrepancyType": "SHORT_RECEIVED",
      "QtyDifference": -2,
      "Reason": "Damaged in transit"
    }
  ],
  "ReceivedBy": "Sprocket Warehouse",
  "VerifiedBy": "Sprocket QC"
}
```

---

### Step 11: Mark as Received in ANSEI System
**Endpoint:** `PATCH /material-delivery-note/:id/receive`
**Actors:** System (Automated) / Warehouse Staff
**Permission:** `MATERIAL_DELIVERY_UPDATE`

**Process:**
1. System receives GR status from Sprocket API
2. System update MaterialDeliveryOrder:
```
Status: RECEIVED
GRNumber: from input (GR-SPR-20260618-001)
GRDate: from input
ReceivedAt: from input
DiscrepancyItems: from input (if any)
```

3. System record discrepancy for investigation:
```
MaterialDeliveryDiscrepancy:
  - DiscrepancyId: UUID
  - OrderId: FK
  - MaterialId: FK
  - QtyOrdered: from order
  - QtyReceived: from GR
  - QtyDifference: calculated
  - DiscrepancyType: SHORT_RECEIVED / OVER_RECEIVED / DAMAGED
  - Reason: from input
  - ResolutionStatus: PENDING / RESOLVED
  - ResolutionNotes: null
```

4. Notification sent for discrepancy items:
   - Email to Warehouse Manager
   - Alert in system dashboard

**Final Status Flow:**
```
PENDING → PENDING_PICKING → READY_FOR_SHIPMENT → APPROVED → SHIPPED → RECEIVED
                                                              ↓
                                                          PARTIAL_RECEIVED
```

---

## Data Models - Material Transfer to Sprocket

### Database Tables

```
┌──────────────────────────────┐
│ MaterialDeliveryRequest      │
├──────────────────────────────┤
│ RequestId (PK)              │
│ RequestNo                   │  e.g., REQ-SPR-20260618-001
│ RequestDate                 │
│ SourceSystem                │  SPROCKET, OTHER_EXTERNAL
│ Status                      │  PENDING, PROCESSING, COMPLETED, CANCELLED
│ ReferenceDoc                │  PO number from Sprocket
│ DeliveryAddress             │
│ PIC                         │
│ ReceivedAt                  │
│ CreatedAt                   │
└──────────┬───────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────────────┐
│ MaterialDeliveryRequestItem │
├──────────────────────────────┤
│ ItemId (PK)                 │
│ RequestId (FK)              │
│ MaterialId (FK)             │
│ PartNumber                  │
│ QtyRequested                │
│ QtyApproved                 │
│ QtyShipped                  │
│ RequiredDate                │
│ Status                      │  PENDING, APPROVED, PARTIAL, BACKORDER, SHIPPED
│ Notes                       │
└──────────┬───────────────────┘
           │
           │ References
           ▼
┌──────────────────────────────┐
│   MaterialDeliveryOrder      │
├──────────────────────────────┤
│ OrderId (PK)                │
│ OrderNo                      │  e.g., MDO-20260618-0001
│ RequestId (FK)               │
│ Status                       │  PENDING_PICKING, READY_FOR_SHIPMENT, APPROVED
│                              │  SHIPPED, RECEIVED, PARTIAL_RECEIVED
│ AssignedTo                   │
│ PrintedDNAt                 │
│ ApprovedBy                   │
│ ApprovedAt                   │
│ ShippedBy                    │
│ ShippedAt                    │
│ GRNumber                     │  From Sprocket
│ GRDate                       │  From Sprocket
│ ReceivedAt                   │
│ CreatedAt                    │
└──────────┬───────────────────┘
           │
           │ 1:N
           ▼
┌──────────────────────────────┐
│  MaterialDeliveryOrderItem   │
├──────────────────────────────┤
│ ItemId (PK)                 │
│ OrderId (FK)                │
│ MaterialId (FK)             │
│ QtyOrdered                  │
│ QtyPicked                   │
│ QtyShipped                  │
│ RackLocation                │
│ Status                      │  PENDING, PICKED, SHIPPED
└──────────────────────────────┘
```

### Additional Tables for Discrepancy

```
┌──────────────────────────────┐
│ MaterialDeliveryDiscrepancy  │
├──────────────────────────────┤
│ DiscrepancyId (PK)          │
│ OrderId (FK)                │
│ MaterialId (FK)             │
│ QtyOrdered                  │
│ QtyReceived                 │
│ QtyDifference               │
│ DiscrepancyType             │  SHORT_RECEIVED, OVER_RECEIVED, DAMAGED
│ Reason                      │
│ ResolutionStatus            │  PENDING, UNDER_INVESTIGATION, RESOLVED
│ ResolutionNotes             │
│ ResolvedBy                  │
│ ResolvedAt                  │
│ CreatedAt                   │
└──────────────────────────────┘
```

---

## API Integration Points

### External API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/external/material-request` | Receive request from Sprocket |
| GET | `/external/material-request/:requestNo` | Get request status |
| POST | `/external/material-request/:requestNo/status` | Receive GR status from Sprocket |

### Authentication

```
Header: X-API-Key: <service_api_key>
Header: X-Source-System: SPROCKET
```

### Webhook Notifications (Optional)

```
When delivery status changes:
- ANSEI → SPROCKET: POST /webhook/delivery-status
```

---

## Error Handling & Recovery

### Common Issues

| Issue | Handling |
|-------|----------|
| Material out of stock | System creates BACKORDER, notify when stock available |
| Qty picked < Qty ordered | Partial shipment, update discrepancy |
| Sprocket receives wrong items | Create return request, coordinate pickup |
| GR discrepancy | Investigation, adjust in next delivery or credit note |

### Recovery Flow

```
If GR shows discrepancy:
1. System creates MaterialDeliveryDiscrepancy
2. Notify Warehouse Manager
3. Manager investigates:
   - Check picking records
   - Check delivery records
   - Coordinate with Sprocket
4. Resolution options:
   - Credit note to Sprocket
   - Replacement in next delivery
   - Return pickup
5. Update ResolutionStatus to RESOLVED
```

---



---

# ============================================================================
# 5. MASTER DATA MODELS
# ============================================================================

## Data Model Summary

### Material Flow Models
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Material   │     │  Incoming   │────▶│IncomingItem │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ Id          │◀────│ MaterialId  │     │ Id          │
│ PartNumber  │     │ IncomingNo  │     │ IncomingId  │
│ PartName    │     │ Status      │     │ MaterialId  │
│ QtyRack     │     └─────────────┘     │ QtyReceived │
│ QtyWarehouse│                              │ QtyRejected │
│ RackLocation│     ┌─────────────┐     └─────────────┘
│ SatuanId    │     │ Material    │            │
└─────────────┘     │ Transfer    │
                    ├─────────────┤     ┌─────────────┐
                    │ Id          │◀────│TransferItem│
                    │ TransferNo  │     ├─────────────┤
                    │ TransferType│     │ Id          │
                    │ Status      │     │ TransferId  │
                    │ Source/Dest │     │ MaterialId  │
                    └─────────────┘     │ Qty         │
                                        │ Status      │
                                        └─────────────┘
```

### Production Flow Models
```
┌─────────────────┐     ┌─────────────────┐
│ Production      │     │ Production       │
│ Forecast        │────▶│ Plan             │
├─────────────────┤     ├─────────────────┤
│ Id              │     │ Id               │
│ CustomerName    │     │ PlanNo           │
│ PartNumber      │     │ Status           │
│ Qty             │     │ PlanDate         │
│ DeliveryDate    │     └────────┬──────────┘
│ Status          │              │ 1:N
└─────────────────┘              ▼
                         ┌─────────────────┐     ┌─────────────────┐
                         │ PlanItem        │────▶│ ShoppingList    │
                         ├─────────────────┤     ├─────────────────┤
                         │ Id              │     │ Id               │
                         │ PlanId          │     │ PlanId           │
                         │ ForecastId      │     │ Status           │
                         │ Status          │     └────────┬──────────┘
                         └─────────────────┘              │ 1:N
                                                           ▼
                         ┌─────────────────┐     ┌─────────────────┐
                         │ ShoppingItem    │◀────│ Delivery        │
                         ├─────────────────┤     ├─────────────────┤
                         │ Id              │     │ Id               │
                         │ ListId          │     │ DeliveryNo       │
                         │ MaterialId      │     │ Status           │
                         │ QtyNeeded       │     │ PlanId           │
                         │ QtyPicked       │     └────────┬──────────┘
                         │ Status          │              │ 1:N
                         └─────────────────┘              ▼
                                                   ┌─────────────────┐
                                                   │ DeliveryItem    │
                                                   ├─────────────────┤
                                                   │ Id              │
                                                   │ DeliveryId      │
                                                   │ FinishGoodId    │
                                                   │ QtyDelivered    │
                                                   └─────────────────┘
```

### Finish Good & BOM
```
┌─────────────┐     ┌─────────────┐
│ FinishGood  │     │ BillOf      │
├─────────────┤     │ Materials   │
│ Id          │◀────│ FinishGoodId│
│ PartNumber  │     ├─────────────┤
│ PartName    │     │ Id          │
│ Qty         │     │ FinishGoodId│
│ RackLocation│     │ MaterialId  │
└─────────────┘     │ QtyPerUnit  │
                    └─────────────┘
                          ▲
                          │
┌─────────────┐     ┌─────────────┐
│ Material    │────▶│ BOMDetail   │
├─────────────┤     ├─────────────┤
│ Id          │     │ Id          │
│ PartNumber  │     │ BOMId       │
│ QtyRack     │     │ MaterialId  │
│ QtyWarehouse│     │ QtyPerUnit  │
└─────────────┘     └─────────────┘
```

### Inventory Ledger (The Source of Truth)
```
┌─────────────────────────┐
│   InventoryLedger       │
├─────────────────────────┤
│ Id                      │  UUID
│ ItemCategory            │  MATERIAL | FINISH_GOOD
│ MaterialId (nullable)   │  FK to Material
│ FinishGoodId (nullable) │  FK to FinishGood
│ LocationType            │  WAREHOUSE | RACK | FINISH_GOOD_AREA
│ TransactionType         │  See below
│ ReferenceDoc            │  Related document number
│ BalanceBefore           │  Saldo sebelum transaksi
│ QtyIn                   │  Jumlah masuk
│ QtyOut                  │  Jumlah keluar
│ BalanceAfter            │  = BalanceBefore + QtyIn - QtyOut
│ Notes                   │  Optional notes
│ CreatedBy               │  User atau SYSTEM
│ CreatedAt               │  Timestamp
└─────────────────────────┘

TransactionType Values:
- INCOMING_SUPPLIER     → Material masuk dari supplier
- TRANSFER_TO_RACK       → Transfer dari warehouse ke rack
- PRODUCTION_USAGE       → Material digunakan untuk produksi
- PRODUCTION_RESULT      → Finish good hasil produksi
- DELIVERY_TO_CUSTOMER   → Finish good dikirim ke customer
- NG_SCRAP              → barang NG / discards
- ADJUSTMENT_MANUAL      → Manual adjustment (rare)
- STOCK_OPNAME_DIFF      → Adjustment dari stock opname
- MATERIAL_OUT_DELIVERY  → Material dikirim ke external (Sprocket)
```

---

# ============================================================================
# 6. QUICK REFERENCE - API ENDPOINTS
# ============================================================================

## Master Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/master/material` | List all materials |
| GET | `/master/material/:id` | Get material by ID |
| POST | `/master/material` | Create material |
| PATCH | `/master/material/:id` | Update material |
| DELETE | `/master/material/:id` | Delete material |
| GET | `/master/finish-good` | List all finish goods |
| POST | `/master/finish-good` | Create finish good |
| PATCH | `/master/finish-good/:id` | Update finish good |

## Warehouse - Incoming
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/warehouse/incoming` | List all incoming records |
| GET | `/warehouse/incoming/:id` | Get incoming details |
| POST | `/warehouse/incoming` | Create incoming record |
| PATCH | `/warehouse/incoming/:id/approve` | Approve incoming |
| PATCH | `/warehouse/incoming/:id/stock-in` | Stock in to warehouse |

## Warehouse - Transfer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/warehouse/transfer` | List all transfers |
| POST | `/warehouse/transfer` | Create transfer request |
| PATCH | `/warehouse/transfer/:id/stock-out` | Stock out from source |
| PATCH | `/warehouse/transfer/:id/stock-in-rack` | Stock in to rack |

## Production - Forecast
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/production/forecast/import` | Import forecast from Excel |
| GET | `/production/forecast` | List all forecasts |
| PATCH | `/production/forecast/:id` | Update forecast |

## Production - Release
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/production/production-release` | Generate production release |
| GET | `/production/production-release/:id` | Get release details |
| PATCH | `/production/production-release/:id/close` | Close production plan |

## Production - Shopping
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/production/shopping` | List shopping lists |
| POST | `/production/shopping` | Generate shopping list |
| PATCH | `/production/shopping/:id/pick` | Pick items |
| PATCH | `/production/shopping/:id/stock-out` | Stock out from rack |

## Production - Pokayoke
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/production/pokayoke` | Record QC check |
| GET | `/production/pokayoke/:planId` | Get QC results |

## Production - Delivery
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/production/delivery` | Create delivery |
| PATCH | `/production/delivery/:id/stock-out` | Stock out finish good |

## Inventory Counting
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/inventory-counting` | Create opname activity |
| GET | `/inventory-counting/:id/worksheet` | Download worksheet |
| PATCH | `/inventory-counting/:id/submit` | Submit counting results |
| PATCH | `/inventory-counting/:id/approve` | Approve results |
| PATCH | `/inventory-counting/:id/adjust` | Execute adjustment |
| PATCH | `/inventory-counting/:id/close` | Close opname |

## Material Delivery (Sprocket)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/material-delivery-note` | List delivery orders |
| GET | `/material-delivery-note/:id` | Get delivery details |
| GET | `/material-delivery-note/:id/picking-list` | Get picking list |
| PATCH | `/material-delivery-note/:id/pick` | Pick items |
| GET | `/material-delivery-note/:id/print` | Print delivery note |
| PATCH | `/material-delivery-note/:id/approve` | Approve shipment |
| PATCH | `/material-delivery-note/:id/stock-out` | Stock out materials |
| PATCH | `/material-delivery-note/:id/receive` | Mark as received |

## External API (Sprocket Integration)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/external/material-request` | Receive request from Sprocket |
| POST | `/external/material-request/:requestNo/status` | GR status from Sprocket |

---

# ============================================================================
# 7. STATUS REFERENCE
# ============================================================================

## Incoming Status
```
DRAFT → PENDING_APPROVAL → APPROVED → STOCKED_IN → COMPLETED
                          ↘ REJECTED
```

## Transfer Status
```
DRAFT → PENDING_PICKING → PICKED → STOCK_OUT → STOCKED_IN → COMPLETED
                                  ↘ PARTIAL
```

## Production Plan Status
```
DRAFT → RELEASED → IN_PROGRESS → COMPLETED → CLOSED
                        ↘ CANCELLED
```

## Production Plan Item Status
```
PENDING → READY_TO_DELIVER → DELIVERED → COMPLETED
         ↘ PARTIAL → CANCELLED
```

## Shopping Status
```
DRAFT → PENDING → IN_PROGRESS → COMPLETED
                       ↘ PARTIAL
```

## Delivery Status
```
DRAFT → SHIPPED → RECEIVED
             ↘ PARTIAL_RECEIVED
             ↘ REJECTED
```

## Stock Opname Status
```
DRAFT → IN_PROGRESS → APPROVED → COMPLETED → ARCHIVED
                      ↘ REJECTED
```

## Material Delivery Order Status
```
PENDING_PICKING → READY_FOR_SHIPMENT → APPROVED → SHIPPED → RECEIVED
                                                      ↘ PARTIAL_RECEIVED
```

---

# ============================================================================
# 8. AUDIT & LOGGING
# ============================================================================

## LogProcess Service

Every write operation MUST be logged:

```typescript
// In every service method:
const logProcess = await this.logService.startProcess({
  functionId: 'MODULE_001',
  functionName: 'ServiceName.MethodName',
  createdBy: user.username,
});

// Log steps
await this.logService.addLog({
  processId: logProcess.ProcessId,
  message: 'Step description',
  type: 'INFO', // INFO | WARN | ERROR | DEBUG
  location: 'service.ts:45',
});

// Complete process
await this.logService.completeProcess(
  logProcess.ProcessId,
  'SUCCESS' // SUCCESS | FAILED
);
```

## Process ID Format
```
PR{YYYYMMDD}{HHmmss}{6-digit-unique-id}
Example: PR20260618143052123456
```

## Message ID Format
```
COMM-{3-digit-increment}
Example: COMM-001, COMM-002, ..., COMM-999
```

---

# ============================================================================
# 9. ERROR HANDLING PATTERNS
# ============================================================================

## Standard Error Response
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "qty",
      "message": "qty must be a positive number"
    }
  ]
}
```

## Custom Exception Examples
```typescript
throw new NotFoundException(`Material with ID ${id} not found`);
throw new ConflictException(`Part number ${partNumber} already exists`);
throw new BadRequestException('Insufficient stock for transfer');
```

## Transaction Pattern
```typescript
async createWithTransaction(dto: CreateDto, user: string) {
  return this.prisma.$transaction(async (tx) => {
    // All operations inside transaction
    const result = await tx.model.create({ data: dto });
    await this.logToProcess(tx, result);
    return result;
  });
}
```

---

# ============================================================================
# 10. VALIDATION RULES
# ============================================================================

## Material Validation
- [ ] PartNumber must be unique
- [ ] PartNumber cannot be empty
- [ ] Qty cannot be negative
- [ ] SatuanId must reference existing Satuan

## Incoming Validation
- [ ] SupplierId must reference existing Supplier
- [ ] MaterialId must reference existing Material
- [ ] QtyReceived > 0
- [ ] Status transition must be valid

## Transfer Validation
- [ ] Source location != Destination location
- [ ] Available qty >= Transfer qty
- [ ] Material must exist at source location

## Production Release Validation
- [ ] Forecast items must be PENDING
- [ ] No duplicate Forecast in same Plan
- [ ] BOM must exist for each FinishGood

## Pokayoke Validation
- [ ] Scanned PartNumber must match expected
- [ ] PlanItem must be in valid state
- [ ] Checker must have QC permission

## Delivery Validation
- [ ] QtyDelivered <= QtyReady
- [ ] FinishGood must be READY_TO_DELIVER
- [ ] DeliveryNo must be unique

---

# ============================================================================
# DOCUMENT END
# ============================================================================

*Last Updated: June 2026*
*Version: 2.0*
*Author: Development Team*

