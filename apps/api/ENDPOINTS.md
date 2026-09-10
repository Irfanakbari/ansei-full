# API Endpoints Documentation

## Base URL
```
http://localhost:7500/api/v1
```

## Authentication
All endpoints require JWT Bearer authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Master Data Modules

All master endpoints are prefixed with `/master` and use the following permissions:
- `MASTER_READ` - Required for GET endpoints
- `MASTER_CREATE` - Required for POST endpoints
- `MASTER_UPDATE` - Required for PATCH endpoints
- `MASTER_DELETE` - Required for DELETE endpoints

---

## 1. Satuan (Unit of Measurement)

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/master/satuan` | `MASTER_READ` | Get all satuan |
| GET | `/master/satuan/:id` | `MASTER_READ` | Get satuan by ID |
| POST | `/master/satuan` | `MASTER_CREATE` | Create new satuan |
| PATCH | `/master/satuan/:id` | `MASTER_UPDATE` | Update satuan |
| DELETE | `/master/satuan/:id` | `MASTER_DELETE` | Delete satuan |

### CreateSatuanDto
```typescript
{
  name: string;        // Required - Name of the unit
}
```

### UpdateSatuanDto
```typescript
{
  name?: string;       // Optional - Name of the unit
}
```

### Response: SatuanEntity
```typescript
{
  Id: number;          // Auto-generated ID
  Name: string;        // Unit name
}
```

### Example Requests

**Create:**
```bash
POST /master/satuan
{
  "name": "PCS"
}
```

**Response:**
```json
{
  "Id": 1,
  "Name": "PCS"
}
```

---

## 2. Supplier

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/master/supplier` | `MASTER_READ` | Get all suppliers |
| GET | `/master/supplier/:id` | `MASTER_READ` | Get supplier by ID |
| POST | `/master/supplier` | `MASTER_CREATE` | Create new supplier |
| PATCH | `/master/supplier/:id` | `MASTER_UPDATE` | Update supplier |
| DELETE | `/master/supplier/:id` | `MASTER_DELETE` | Delete supplier |

### CreateSupplierDto
```typescript
{
  name: string;        // Required - Supplier name
}
```

### UpdateSupplierDto
```typescript
{
  name?: string;        // Optional - Supplier name
}
```

### Response: SupplierEntity
```typescript
{
  Id: number;           // Auto-generated ID
  Name: string;         // Supplier name
  CreatedAt: Date;     // Creation timestamp
}
```

### Example Requests

**Create:**
```bash
POST /master/supplier
{
  "name": "PT Supplier Indonesia"
}
```

**Response:**
```json
{
  "Id": 1,
  "Name": "PT Supplier Indonesia",
  "CreatedAt": "2026-06-07T00:00:00.000Z"
}
```

---

## 3. Material

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/master/material` | `MASTER_READ` | Get all materials |
| GET | `/master/material/:id` | `MASTER_READ` | Get material by ID |
| GET | `/master/material/part-number/:partNumber` | `MASTER_READ` | Get material by part number |
| POST | `/master/material` | `MASTER_CREATE` | Create new material |
| PATCH | `/master/material/:id` | `MASTER_UPDATE` | Update material |
| DELETE | `/master/material/:id` | `MASTER_DELETE` | Delete material |

### CreateMaterialDto
```typescript
{
  partNumber: string;       // Required - Part number identifier
  partName: string;         // Required - Part name
  supplier?: string;        // Optional - Supplier name
  satuanId?: number;        // Optional - Satuan ID (FK)
  rackLocation?: string;    // Optional - Rack location
  qtyRack?: number;         // Optional - Quantity in rack (default: 0)
  qtyWarehouse?: number;    // Optional - Quantity in warehouse (default: 0)
  createdBy?: string;       // Optional - Creator username (auto-filled from auth)
}
```

### UpdateMaterialDto
```typescript
{
  partNumber?: string;      // Optional
  partName?: string;        // Optional
  supplier?: string;        // Optional
  satuanId?: number;        // Optional
  rackLocation?: string;    // Optional
  qtyRack?: number;         // Optional
  qtyWarehouse?: number;    // Optional
  createdBy?: string;       // Optional
}
```

### Response: MaterialEntity
```typescript
{
  Id: number;              // Auto-generated ID
  PartNumber: string;      // Part number identifier
  PartName: string;        // Part name
  CreatedAt: Date;        // Creation timestamp
  CreatedBy: string;      // Creator username
  UpdatedAt: Date;         // Last update timestamp
  Supplier: string | null;
  SatuanId: number | null;
  RackLocation: string | null;
  QtyRack: number;        // Current rack quantity
  QtyWarehouse: number;   // Current warehouse quantity
  SatuanData: {           // Related satuan (eager loaded)
    Id: number;
    Name: string;
  } | null;
}
```

### Example Requests

**Create:**
```bash
POST /master/material
{
  "partNumber": "MAT-001",
  "partName": "Screw M5",
  "supplier": "PT Fastener Indonesia",
  "qtyRack": 100,
  "qtyWarehouse": 50
}
```

**Response:**
```json
{
  "Id": 1,
  "PartNumber": "MAT-001",
  "PartName": "Screw M5",
  "CreatedAt": "2026-06-07T00:00:00.000Z",
  "CreatedBy": "admin",
  "UpdatedAt": "2026-06-07T00:00:00.000Z",
  "Supplier": "PT Fastener Indonesia",
  "SatuanId": null,
  "RackLocation": null,
  "QtyRack": 100,
  "QtyWarehouse": 50,
  "SatuanData": null
}
```

---

## 4. Finish Good

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/master/finish-good` | `MASTER_READ` | Get all finish goods |
| GET | `/master/finish-good/:id` | `MASTER_READ` | Get finish good by ID |
| GET | `/master/finish-good/part-number/:partNumber` | `MASTER_READ` | Get finish good by part number |
| POST | `/master/finish-good` | `MASTER_CREATE` | Create new finish good |
| PATCH | `/master/finish-good/:id` | `MASTER_UPDATE` | Update finish good |
| DELETE | `/master/finish-good/:id` | `MASTER_DELETE` | Delete finish good |

### CreateFinishGoodDto
```typescript
{
  partNumber: string;       // Required - Part number identifier
  partName: string;         // Required - Part name
  price?: number;           // Optional - Unit price (must be positive)
  qty?: number;             // Optional - Initial quantity (default: 0)
  createdBy?: string;       // Optional - Creator username (auto-filled from auth)
}
```

### UpdateFinishGoodDto
```typescript
{
  partNumber?: string;      // Optional
  partName?: string;        // Optional
  price?: number;           // Optional (must be positive)
  qty?: number;             // Optional
  createdBy?: string;       // Optional
}
```

### Response: FinishGoodEntity
```typescript
{
  Id: number;              // Auto-generated ID
  PartNumber: string;      // Part number identifier
  PartName: string;        // Part name
  Price: number | null;    // Unit price
  CreatedAt: Date;        // Creation timestamp
  CreatedBy: string;      // Creator username
  UpdatedAt: Date;         // Last update timestamp
  Qty: number;            // Current quantity
}
```

### Example Requests

**Create:**
```bash
POST /master/finish-good
{
  "partNumber": "FG-001",
  "partName": "Product A",
  "price": 15000,
  "qty": 0
}
```

**Response:**
```json
{
  "Id": 1,
  "PartNumber": "FG-001",
  "PartName": "Product A",
  "Price": 15000,
  "CreatedAt": "2026-06-07T00:00:00.000Z",
  "CreatedBy": "admin",
  "UpdatedAt": "2026-06-07T00:00:00.000Z",
  "Qty": 0
}
```

---

## 5. Bill of Materials (BOM)

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/master/bill-of-materials` | `MASTER_READ` | Get all BOMs |
| GET | `/master/bill-of-materials/:finishGoodId` | `MASTER_READ` | Get BOMs by finish good ID |
| GET | `/master/bill-of-materials/material/:materialId` | `MASTER_READ` | Get BOMs by material ID |
| POST | `/master/bill-of-materials` | `MASTER_CREATE` | Create new BOM |
| PATCH | `/master/bill-of-materials/:id` | `MASTER_UPDATE` | Update BOM |
| DELETE | `/master/bill-of-materials/:id` | `MASTER_DELETE` | Delete BOM |

### CreateBillOfMaterialsDto
```typescript
{
  materialId: number;       // Required - Material ID (must be positive)
  finishGoodId: number;      // Required - Finish Good ID (must be positive)
  qty: number;             // Required - Quantity needed (must be positive)
}
```

### UpdateBillOfMaterialsDto
```typescript
{
  materialId?: number;       // Optional (must be positive)
  finishGoodId?: number;    // Optional (must be positive)
  qty?: number;            // Optional (must be positive)
}
```

### Response: BillOfMaterialsEntity
```typescript
{
  Id: number;              // Auto-generated ID
  MaterialId: number;      // Material ID
  FinishGoodId: number;    // Finish Good ID
  Qty: number;             // Quantity needed
  FGData: {                // Related Finish Good (eager loaded)
    Id: number;
    PartNumber: string;
    PartName: string;
  };
  MaterialData: {          // Related Material (eager loaded)
    Id: number;
    PartNumber: string;
    PartName: string;
  };
}
```

### Example Requests

**Create:**
```bash
POST /master/bill-of-materials
{
  "materialId": 1,
  "finishGoodId": 1,
  "qty": 5
}
```

**Response:**
```json
{
  "Id": 1,
  "MaterialId": 1,
  "FinishGoodId": 1,
  "Qty": 5,
  "FGData": {
    "Id": 1,
    "PartNumber": "FG-001",
    "PartName": "Product A"
  },
  "MaterialData": {
    "Id": 1,
    "PartNumber": "MAT-001",
    "PartName": "Screw M5"
  }
}
```

---

## 6. Box QTY

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/master/box-qty` | `MASTER_READ` | Get all box quantities |
| GET | `/master/box-qty/:id` | `MASTER_READ` | Get box qty by ID |
| GET | `/master/box-qty/part-number/:partNumber` | `MASTER_READ` | Get box qty by part number |
| POST | `/master/box-qty` | `MASTER_CREATE` | Create new box qty |
| PATCH | `/master/box-qty/:id` | `MASTER_UPDATE` | Update box qty |
| DELETE | `/master/box-qty/:id` | `MASTER_DELETE` | Delete box qty |

### CreateBoxQtyDto
```typescript
{
  partNumber: string;       // Required - Finish Good part number
  qty: number;              // Required - Box quantity (must be positive)
}
```

### UpdateBoxQtyDto
```typescript
{
  partNumber?: string;      // Optional
  qty?: number;            // Optional (must be positive)
}
```

### Response: BoxQTYEntity
```typescript
{
  Id: number;              // Auto-generated ID
  PartNumber: string;      // Finish Good part number
  Qty: number;            // Box quantity
  PartData: {             // Related Finish Good (eager loaded)
    PartNumber: string;
    PartName: string;
  };
}
```

### Example Requests

**Create:**
```bash
POST /master/box-qty
{
  "partNumber": "FG-001",
  "qty": 12
}
```

**Response:**
```json
{
  "Id": 1,
  "PartNumber": "FG-001",
  "Qty": 12,
  "PartData": {
    "PartNumber": "FG-001",
    "PartName": "Product A"
  }
}
```

---

## 7. Man Power

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/master/man-power` | `MASTER_READ` | Get all man power |
| GET | `/master/man-power/:uid` | `MASTER_READ` | Get man power by UID |
| GET | `/master/man-power/nik/:nik` | `MASTER_READ` | Get man power by NIK |
| POST | `/master/man-power` | `MASTER_CREATE` | Create new man power |
| PATCH | `/master/man-power/:uid` | `MASTER_UPDATE` | Update man power |
| DELETE | `/master/man-power/:uid` | `MASTER_DELETE` | Delete man power |

### CreateManPowerDto
```typescript
{
  nik: string;             // Required - Employee NIK
  name: string;            // Required - Employee name
  line?: string;           // Optional - Production line
  status?: boolean;        // Optional - Active status (default: true)
}
```

### UpdateManPowerDto
```typescript
{
  nik?: string;           // Optional
  name?: string;          // Optional
  line?: string;          // Optional
  status?: boolean;       // Optional
}
```

### Response: ManPowerEntity
```typescript
{
  Uid: string;            // Unique identifier (auto-generated UUID)
  Nik: string;            // Employee NIK
  Name: string;           // Employee name
  CreatedAt: Date;        // Creation timestamp
  Status: boolean;       // Active status
  Line: string | null;    // Production line
}
```

### Example Requests

**Create:**
```bash
POST /master/man-power
{
  "nik": "EMP001",
  "name": "John Doe",
  "line": "LINE-A",
  "status": true
}
```

**Response:**
```json
{
  "Uid": "abc123-def456-ghi789",
  "Nik": "EMP001",
  "Name": "John Doe",
  "CreatedAt": "2026-06-07T00:00:00.000Z",
  "Status": true,
  "Line": "LINE-A"
}
```

---

## 8. Incoming (Warehouse)

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/warehouse/incoming` | `INCOMING_READ` | Get all incoming records |
| GET | `/warehouse/incoming/:id` | `INCOMING_READ` | Get incoming by ID |
| GET | `/warehouse/incoming/po/:poId` | `INCOMING_READ` | Get incoming by PO ID |
| POST | `/warehouse/incoming` | `INCOMING_CREATE` | Create new incoming record |
| PATCH | `/warehouse/incoming/:id` | `INCOMING_UPDATE` | Update incoming |
| DELETE | `/warehouse/incoming/:id` | `INCOMING_DELETE` | Delete incoming |
| POST | `/warehouse/incoming/:id/receive` | `INCOMING_UPDATE` | Receive incoming materials |

### CreateIncomingDto
```typescript
{
  id: string;              // Required - Incoming ID
  poId: string;           // Required - PO ID
  supplierId: number;      // Required - Supplier ID
  receivedBy: string;      // Required - Receiver name
  description?: string;    // Optional - Description
  materials: [             // Required - Array of materials
    { materialId: number; qty: number; }
  ];
}
```

### UpdateIncomingDto
```typescript
{
  supplierId?: number;       // Optional
  receivedBy?: string;    // Optional
  description?: string;    // Optional
  materials?: [           // Optional
    { materialId: number; qty: number; }
  ];
}
```

### Response: IncomingEntity
```typescript
{
  Id: string;
  PoId: string;
  SupplierId: number;
  ReceivedBy: string;
  Description: string | null;
  CreatedAt: Date;
  CreatedBy: string;
  UpdatedAt: Date;
  SupplierData: { Id: number; Name: string };
  IncomingMaterials: [
    { Id: number; MaterialId: number; Qty: number; MaterialData: { Id: number; PartNumber: string; PartName: string; } | null;
  ];
}
```

### Example Requests

**Create:**
```bash
POST /warehouse/incoming
{
  "id": "INC-001",
  "poId": "PO-2024-001",
  "supplierId": 1,
  "receivedBy": "John Doe",
  "materials": [
    { "materialId": 1, "qty": 100 },
    { "materialId": 2, "qty": 50 }
  ]
}
```

**Receive:**
```bash
POST /warehouse/incoming/INC-001/receive
```

---

## 9. Transfer (Warehouse)

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/warehouse/material/:partNumber/transfer-to-rack` | `TRANSFER_CREATE` | Transfer stock from warehouse to rack |

### TransferToRackDto
```typescript
{
  qty: number;             // Required - Quantity to transfer (must be positive)
}
```

### TransferToRackResponse
```typescript
{
  success: boolean;
  partNumber: string;
  warehouseBefore: number;
  warehouseAfter: number;
  rackBefore: number;
  rackAfter: number;
  transferQty: number;
}
```

### Example Requests

**Transfer to Rack:**
```bash
POST /warehouse/material/MAT-001/transfer-to-rack
{
  "qty": 50
}
```

**Response:**
```json
{
  "success": true,
  "partNumber": "MAT-001",
  "warehouseBefore": 100,
  "warehouseAfter": 50,
  "rackBefore": 20,
  "rackAfter": 70,
  "transferQty": 50
}
```

---

## 10. Forecast (Production)

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/production/forecast` | `FORECAST_READ` | Get all forecasts |
| GET | `/production/forecast/operator` | `FORECAST_READ` | Get forecasts for operator (next 14 days, RELEASED status) |
| GET | `/production/forecast/:id` | `FORECAST_READ` | Get forecast by ID |
| POST | `/production/forecast` | `FORECAST_CREATE` | Create new forecast |
| POST | `/production/forecast/import` | `FORECAST_CREATE` | Import forecasts from Excel file |
| PATCH | `/production/forecast/:id` | `FORECAST_UPDATE` | Update forecast |
| DELETE | `/production/forecast/:id` | `FORECAST_DELETE` | Delete forecast |

### CreateForecastDto
```typescript
{
  poId: string;               // Required - PO ID
  date: Date;                 // Required - Date (ISO string)
  vendorCode: string;         // Required - Vendor code
  vendorName: string;         // Required - Vendor name
  receivingArea: string;       // Required - Receiving area
  deliveryDate: Date;         // Required - Delivery date (ISO string)
  deliveryPeriod: number;     // Required - Delivery period (days)
  classification: string;      // Required - Classification
  poNumber: string;           // Required - PO number
  item: number;              // Required - Item number
  qty: number;               // Required - Quantity
  finishGoodId: string;       // Required - Finish Good ID
}
```

### UpdateForecastDto
```typescript
{
  status?: string;            // Optional - Status (PENDING | RELEASED | COMPLETED | CANCELLED)
  // All create fields are optional
}
```

### Response: ForecastEntity
```typescript
{
  Id: string;
  PoId: string;
  Date: Date;
  VendorCode: string;
  VendorName: string;
  ReceivingArea: string;
  DeliveryDate: Date;
  DeliveryPeriod: number;
  Classification: string;
  PoNumber: string;
  Item: number;
  Qty: number;
  FinishGoodId: string;
  Status: string;
  CreatedAt: Date;
  CreatedBy: string;
  FGData: { PartNumber: string; PartName: string; };
}
```

### Example Requests

**Create:**
```bash
POST /production/forecast
{
  "poId": "PO-2024-001",
  "date": "2024-06-10T00:00:00Z",
  "vendorCode": "VC001",
  "vendorName": "PT Supplier Indonesia",
  "receivingArea": "WAREHOUSE-A",
  "deliveryDate": "2024-06-15T00:00:00Z",
  "deliveryPeriod": 5,
  "classification": "REGULAR",
  "poNumber": "PO-2024-001",
  "item": 1,
  "qty": 100,
  "finishGoodId": "FG-001"
}
```

**Import Excel:**
```bash
POST /production/forecast/import
Content-Type: multipart/form-data

file: <excel-file.xlsx>
```

---

## 11. Production Release

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/production/production-release` | `PRODUCTION_REALEASE_READ` | Get all releases |
| GET | `/production/production-release/:id` | `PRODUCTION_REALEASE_READ` | Get release by ID |
| GET | `/production/production-release/:id/labels` | `PRODUCTION_REALEASE_READ` | Get labels for release |
| GET | `/production/production-release/release-number/:releaseNumber` | `PRODUCTION_REALEASE_READ` | Get by release number |
| POST | `/production/production-release` | `PRODUCTION_REALEASE_CREATE` | Create new release |
| PATCH | `/production/production-release/:id` | `PRODUCTION_REALEASE_UPDATE` | Update release |
| DELETE | `/production/production-release/:id` | `PRODUCTION_REALEASE_DELETE` | Delete release |

### CreateProductionReleaseDto
```typescript
{
  releaseNumber: string;      // Required - Release number
  planDate: Date;           // Required - Plan date (ISO string)
  notes?: string;           // Optional - Notes
  forecastIds?: string[];    // Optional - Array of forecast IDs
}
```

### UpdateProductionReleaseDto
```typescript
{
  status?: string;           // Optional - Status
  notes?: string;           // Optional - Notes
  forecastIds?: string[];    // Optional - Array of forecast IDs
}
```

### Response: ProductionReleaseEntity
```typescript
{
  Id: string;
  ReleaseNumber: string;
  PlanDate: Date;
  Status: string;
  Notes: string | null;
  CreatedAt: Date;
  CreatedBy: string;
  Forecasts: [
    {
      Id: string;
      PoId: string;
      FinishGoodId: string;
      Qty: number;
    }
  ];
}
```

### Example Requests

**Create:**
```bash
POST /production/production-release
{
  "releaseNumber": "REL-2024-001",
  "planDate": "2024-06-15T00:00:00Z",
  "notes": "Urgent production",
  "forecastIds": ["FORECAST-ID-1", "FORECAST-ID-2"]
}
```

---

## 12. Shopping (Production)

### Overview
Shopping adalah proses **picking material** sesuai dengan **Bill of Materials (BOM)** untuk suatu **Forecast** yang sudah **RELEASED**. 

Terdapat 2 tipe shopping:
- **REGULER**: Terikat dengan Forecast & BOM, menggunakan Poka-Yoke strict
- **ADDITIONAL**: Tidak terikat Forecast, bebas picking material

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/production/shopping` | `SHOPPING_READ` | Get all shopping records |
| GET | `/production/shopping/:id` | `SHOPPING_READ` | Get shopping by ID |
| GET | `/production/shopping/forecast/:forecastId` | `SHOPPING_READ` | Get by forecast ID |
| GET | `/production/shopping/forecast/:forecastId/status` | `SHOPPING_READ` | Get BOM summary & picking progress |
| GET | `/production/shopping/material/:materialId` | `SHOPPING_READ` | Get by material ID |
| POST | `/production/shopping` | `SHOPPING_CREATE` | Create shopping (pick material) |
| DELETE | `/production/shopping/:id` | `SHOPPING_DELETE` | Delete shopping |

### CreateShoppingDto
```typescript
{
  forecastId: string;       // Required for REGULER, optional for ADDITIONAL
  materialId: string;        // Required - Material part number
  qtyPick: number;          // Required - Quantity to pick
  type: 'REGULER' | 'ADDITIONAL';  // Required - Type
  description?: string;     // Optional - Description
}
```

### Response: ShoppingEntity
```typescript
{
  Id: string;
  ForecastId: string;
  MaterialId: string;
  QtyPick: number;
  Type: string;
  Description: string | null;
  CreatedAt: Date;
  CreatedBy: string;
  MaterialData: {
    PartNumber: string;
    PartName: string;
    QtyRack: number;
  };
  ForecastData: {
    PoId: string;
    Qty: number;
  };
}
```

### Response: ForecastPickingStatus
```typescript
{
  forecastId: string;
  finishGoodId: string;
  finishGoodName: string;
  forecastQty: number;
  status: string | null;        // ProductionRelease status
  bomSummary: [
    {
      materialId: string;
      materialName: string;
      bomQtyPerUnit: number;     // Qty per 1 Finish Good
      totalRequired: number;     // ForecastQty × bomQtyPerUnit
      alreadyPicked: number;     // Total qty already picked
      remainingToPick: number;    // Remaining qty to pick
      isCompleted: boolean;       // true if remainingToPick <= 0
    }
  ];
  progress: {
    totalMaterials: number;
    completedMaterials: number;
    totalPickedPercent: number;
  };
}
```

### Example Requests

**REGULER Shopping (with Poka-Yoke):**
```bash
POST /production/shopping
{
  "forecastId": "PO-001",
  "materialId": "MAT-001",
  "qtyPick": 200,
  "type": "REGULER",
  "description": "Material for production"
}
```

**ADDITIONAL Shopping (no Forecast, free pick):**
```bash
POST /production/shopping
{
  "forecastId": "ADDITIONAL",
  "materialId": "MAT-001",
  "qtyPick": 50,
  "type": "ADDITIONAL",
  "description": "Additional material for line changeover"
}
```

**Get Forecast Picking Status:**
```bash
GET /production/shopping/forecast/PO-001/status
```

**Response:**
```json
{
  "forecastId": "PO-001",
  "finishGoodId": "FG-001",
  "finishGoodName": "Product A",
  "forecastQty": 100,
  "status": "RELEASED",
  "bomSummary": [
    {
      "materialId": "MAT-001",
      "materialName": "Screw M5",
      "bomQtyPerUnit": 2,
      "totalRequired": 200,
      "alreadyPicked": 0,
      "remainingToPick": 200,
      "isCompleted": false
    },
    {
      "materialId": "MAT-002",
      "materialName": "Nut M5",
      "bomQtyPerUnit": 2,
      "totalRequired": 200,
      "alreadyPicked": 200,
      "remainingToPick": 0,
      "isCompleted": true
    }
  ],
  "progress": {
    "totalMaterials": 2,
    "completedMaterials": 1,
    "totalPickedPercent": 50
  }
}
```

### POKAYOKE Validations (REGULER Mode - STRICT)

| Step | Validation | Error Message |
|------|------------|--------------|
| 1 | Material exists in Material master | Material not found |
| 2 | Forecast exists | Forecast not found |
| 3 | Forecast is RELEASED | Forecast belum RELEASED |
| 4 | Material exists in BOM for this FG | Material TIDAK ADA dalam BOM |
| 5 | Calculate: totalRequired = ForecastQty × BOMQty | - |
| 6 | Get alreadyPicked from previous shopping | - |
| 7 | **UNDER-PICKING not allowed** (STRICT) | QtyPick < remainingToPick |
| 8 | **OVER-PICKING not allowed** (STRICT) | QtyPick > remainingToPick |
| 9 | Sufficient stock in QtyRack | Insufficient stock |

**Note:** For REGULER mode, operator MUST pick exactly `remainingToPick` (no more, no less).

### ADDITIONAL Mode
- Not bound to Forecast
- No BOM validation
- Free to pick any quantity
- Only stock validation

---

## 13. Inventory Ledger (System Log)

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/system-log/inventory-ledger` | `SYSTEM_LOG_READ` | Get all inventory ledger records |

### InventoryLedgerQueryDto
```typescript
{
  page?: number;              // Optional - Page number (default: 1)
  limit?: number;             // Optional - Records per page (default: 50)
  transactionDateFrom?: string;  // Optional - Start date (YYYY-MM-DD)
  transactionDateTo?: string;   // Optional - End date (YYYY-MM-DD)
  itemCategory?: ItemCategory;   // Optional - MATERIAL | FINISH_GOOD
  transactionType?: TransactionType; // Optional - Transaction type
  materialId?: string;        // Optional - Material PartNumber
  finishGoodId?: string;      // Optional - FinishGood PartNumber
  referenceDoc?: string;       // Optional - Reference document (partial match)
  createdBy?: string;         // Optional - Created by (partial match)
}
```

### Response: PaginatedInventoryLedgerDto
```typescript
{
  data: [
    {
      id: string; // UUID
      transactionDate: Date;      // Transaction timestamp
      itemCategory: ItemCategory; // MATERIAL | FINISH_GOOD
      materialId: string | null;   // Material PartNumber
      finishGoodId: string | null; // FinishGood PartNumber
      location: LocationType;     // WAREHOUSE | RACK | FINISH_GOOD_AREA
      transactionType: TransactionType;
      referenceDoc: string;       // Reference document number
      balanceBefore: number;      // Balance before transaction
      qtyIn: number;              // Quantity in
      qtyOut: number;             // Quantity out
      balanceAfter: number;       // Balance after transaction
      createdBy: string;          // User who created
      notes: string | null;        // Optional notes
    }
  ];
  total: number;               // Total records matching filter
  page: number;               // Current page
  limit: number;             // Records per page
  totalPages: number;         // Total pages
}
```

### Example Requests

**Get all records (paginated):**
```bash
GET /system-log/inventory-ledger?page=1&limit=50
```

**Filter by date range:**
```bash
GET /system-log/inventory-ledger?transactionDateFrom=2026-01-01&transactionDateTo=2026-06-30
```

**Filter by Material and Transaction Type:**
```bash
GET /system-log/inventory-ledger?materialId=MAT-001&transactionType=INCOMING_SUPPLIER
```

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "transactionDate": "2026-06-09T10:30:00.000Z",
      "itemCategory": "MATERIAL",
      "materialId": "MAT-001",
      "finishGoodId": null,
      "location": "WAREHOUSE",
      "transactionType": "INCOMING_SUPPLIER",
      "referenceDoc": "PO-2024-001",
      "balanceBefore": 100,
      "qtyIn": 50,
      "qtyOut": 0,
      "balanceAfter": 150,
      "createdBy": "admin",
      "notes": "Incoming from PO: PO-2024-001"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

---

## 14. Production Report

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/production/production-report` | `PRODUCTION_REPORT_READ` | Get all production reports (paginated) |
| GET | `/production/production-report/:id` | `PRODUCTION_REPORT_READ` | Get production report by ID |
| POST | `/production/production-report` | **PUBLIC** | Create new production report (for Operator Station) |
| PATCH | `/production/production-report/:id` | `PRODUCTION_REPORT_UPDATE` | Update production report |
| DELETE | `/production/production-report/:id` | `PRODUCTION_REPORT_DELETE` | Delete production report |
| POST | `/production/production-report/:id/validate` | `PRODUCTION_REPORT_UPDATE` | Validate production report |
| POST | `/production/production-report/:id/unvalidate` | `PRODUCTION_REPORT_UPDATE` | Unvalidate production report |

> **Note:** POST `/production/production-report` is a **PUBLIC endpoint** (no authentication required) designed for Operator Station / AI integration. CreatedBy is set to `OPERATOR`.

### ProductionReportQueryDto
```typescript
{
  page?: number;              // Optional - Page number (default: 1)
  limit?: number;             // Optional - Records per page (default: 50)
  date?: string;             // Optional - Filter by date (YYYY-MM-DD)
  manPowerUid?: string;      // Optional - Filter by ManPower UID
  finishGoodId?: string;      // Optional - Filter by FinishGood PartNumber
  recordType?: PartType;       // Optional - Filter by record type (ONE, TWO, THREE, FOUR)
  isValidated?: boolean;       // Optional - Filter by validation status
}
```

### CreateProductionReportDto
```typescript
{
  date?: string;              // Optional - Production date (YYYY-MM-DD)
  time?: string;             // Optional - Production time (HH:mm:ss)
  productionStamp: string;    // Required - Production timestamp (ISO date string)
  ngQty?: number;            // Optional - NG quantity (default: 0)
  startTime?: string;         // Optional - Start time (HH:mm:ss)
  startStamp?: string;        // Optional - Start timestamp
  endTime?: string;           // Optional - End time (HH:mm:ss)
  endStamp?: string;          // Optional - End timestamp
  stopMinute?: number;        // Optional - Stop duration in minutes (default: 0)
  latchDate?: string;         // Optional - Latch date (YYYY-MM-DD)
  cableHDate?: string;       // Optional - Cable H date (YYYY-MM-DD)
  cableLDate?: string;        // Optional - Cable L date (YYYY-MM-DD)
  coverDate?: string;         // Optional - Cover date (YYYY-MM-DD)
  rodDate?: string;           // Optional - Rod date (YYYY-MM-DD)
  sponsDate?: string;         // Optional - Spons date (YYYY-MM-DD)
  sponsRearDate?: string;     // Optional - Spons rear date (YYYY-MM-DD)
  clipDate?: string;          // Optional - Clip date (YYYY-MM-DD)
  leverDate?: string;         // Optional - Lever date (YYYY-MM-DD)
  smallPadDate?: string;      // Optional - Small pad date (YYYY-MM-DD)
  actuatorDate?: string;      // Optional - Actuator date (YYYY-MM-DD)
  backPlateDate?: string;     // Optional - Back plate date (YYYY-MM-DD)
  stampDate?: string;         // Optional - Stamp date (YYYY-MM-DD)
  poNumber?: string;          // Optional - PO Number
  recordType: PartType;       // Required - Record type (ONE, TWO, THREE, FOUR)
  qty: number;                // Required - Good quantity
  manPowerUid: string;        // Required - ManPower UID (NIK)
  finishGoodId: string;        // Required - FinishGood PartNumber
}
```

### POKAYOKE Validations

| # | Validation | Error Message |
|---|------------|---------------|
| 1 | ManPower must exist in master | ManPower with UID {uid} not found |
| 2 | FinishGood must exist in master | FinishGood with PartNumber {partNumber} not found |
| 3 | No duplicate record | Production report already exists for Date/ManPower/FinishGood |
| 4 | FinishGood in RELEASED ProductionRelease | FinishGood {partNumber} not in any RELEASED production release |
| 5 | Cannot update validated report | Cannot update validated production report |
| 6 | Cannot delete validated report | Cannot delete validated production report |
| 7 | Cannot validate already validated report | Production report already validated |

### Example Requests

**Create Production Report:**
```bash
POST /production/production-report
{
  "date": "2026-06-09",
  "time": "14:30:00",
  "productionStamp": "2026-06-09T14:30:00Z",
  "ngQty": 2,
  "recordType": "ONE",
  "qty": 100,
  "manPowerUid": "550e8400-e29b-41d4-a716-446655440000",
  "finishGoodId": "FG-001"
}
```

**Validate Production Report:**
```bash
POST /production/production-report/1/validate
```

**Unvalidate Production Report:**
```bash
POST /production/production-report/1/unvalidate
```

**Response:**
```json
{
  "id": 1,
  "date": "2026-06-09",
  "time": "14:30:00",
  "productionStamp": "2026-06-09T14:30:00.000Z",
  "ngQty": 2,
  "startTime": null,
  "startStamp": null,
  "endTime": null,
  "endStamp": null,
  "stopMinute": 0,
  "recordType": "ONE",
  "qty": 100,
  "manPowerUid": "550e8400-e29b-41d4-a716-446655440000",
  "finishGoodId": "FG-001",
  "validatedAt": "2026-06-09T15:00:00.000Z",
  "validatedBy": "admin",
  "manPowerData": {
    "Uid": "550e8400-e29b-41d4-a716-446655440000",
    "Nik": "NIK001",
    "Name": "John Doe"
  },
  "fgData": {
    "PartNumber": "FG-001",
    "PartName": "Finish Good A"
  }
}
```

**Notes:**
- After creating/updating/deleting a production report, the system automatically updates `ProductionRelease.TotalGoodQty` and `ProductionRelease.TotalNgQty`
- Validated reports cannot be modified or deleted

---

## 15. Pre-Delivery (Label Data)

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/production/pre-delivery` | `PRE_DELIVERY_READ` | Get all label data (read-only, paginated) |
| GET | `/production/pre-delivery/summary` | `PRE_DELIVERY_READ` | Get summary statistics |
| GET | `/production/pre-delivery/:id` | `PRE_DELIVERY_READ` | Get one label data by ID |

### PreDeliveryQueryDto
```typescript
{
  page?: number;              // Optional - Page number (default: 1)
  limit?: number;             // Optional - Records per page (default: 50)
  productionReleaseId?: string; // Optional - Filter by ProductionRelease ID (UUID)
  forecastId?: string;        // Optional - Filter by Forecast ID (PoId)
  finishGoodId?: string;      // Optional - Filter by FinishGood PartNumber
  labelNumber?: string;       // Optional - Filter by LabelNumber (partial match)
  scanned?: boolean;          // Optional - Filter by Scanned status
}
```

> **Note:** When using `productionReleaseId` filter, the system first queries the `ProductionRelease` table to get all associated `Forecasts.PoId`, then filters `LabelData` where `ForecastId` is in that list.

### Response: PaginatedPreDeliveryDto
```typescript
{
  data: PreDeliveryLabelDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
```

### PreDeliveryLabelDto
```typescript
{
  id: number;                 // Label ID
  labelNumber: string;        // Unique label number (e.g., PO-00100100005)
  finishGoodId: string;      // FinishGood PartNumber
  finishGoodName: string | null; // FinishGood name
  forecastId: string;        // Forecast/PO ID
  vendorName: string | null; // Vendor name from Forecast
  scanned: boolean;           // Whether label has been scanned
  qtyThisBox: number;        // Quantity in this box
  productionReleaseId: string | null; // ProductionRelease UUID
  productionReleaseNumber: string | null; // Release number (e.g., PR-20260609-001)
  deliveryDate: Date | null; // Delivery date from Forecast
}
```

### Summary Response: PreDeliverySummaryDto
```typescript
{
  total: number;            // Total labels
  scanned: number;          // Scanned labels count
  notScanned: number;       // Not scanned labels count
  percentage: number;       // Scan completion percentage (0-100)
}
```

### Example Requests

**Get all labels (paginated):**
```bash
GET /production/pre-delivery?page=1&limit=50
```

**Filter by ProductionRelease:**
```bash
GET /production/pre-delivery?productionReleaseId=550e8400-e29b-41d4-a716-446655440000
```

**Filter by FinishGood and Scanned status:**
```bash
GET /production/pre-delivery?finishGoodId=FG-001&scanned=false
```

**Get summary for a ProductionRelease:**
```bash
GET /production/pre-delivery/summary?productionReleaseId=550e8400-e29b-41d4-a716-446655440000
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "labelNumber": "PO-00100100005",
      "finishGoodId": "FG-001",
      "finishGoodName": "Finish Good Alpha",
      "forecastId": "PO-001",
      "vendorName": "PT Vuteq Indonesia",
      "scanned": false,
      "qtyThisBox": 100,
      "productionReleaseId": "550e8400-e29b-41d4-a716-446655440000",
      "productionReleaseNumber": "PR-20260609-001",
      "deliveryDate": "2026-06-15T00:00:00.000Z"
    },
    {
      "id": 2,
      "labelNumber": "PO-00100100010",
      "finishGoodId": "FG-001",
      "finishGoodName": "Finish Good Alpha",
      "forecastId": "PO-001",
      "vendorName": "PT Vuteq Indonesia",
      "scanned": true,
      "qtyThisBox": 50,
      "productionReleaseId": "550e8400-e29b-41d4-a716-446655440000",
      "productionReleaseNumber": "PR-20260609-001",
      "deliveryDate": "2026-06-15T00:00:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

**Summary Response:**
```json
{
  "total": 150,
  "scanned": 75,
  "notScanned": 75,
  "percentage": 50
}
```

**Notes:**
- This is a **read-only** module - no create/update/delete operations
- Designed for pre-delivery scanning and validation
- Use `productionReleaseId` to get all labels for a production release

---

## 16. Pokayoke Scan

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/production/pokayoke/scan` | `POKAYOKE_CREATE` | Scan label and perform POKAYOKE validation |
| GET | `/production/pokayoke` | `POKAYOKE_READ` | Get all POKAYOKE scan history (paginated) |

### CreatePokayokeScanDto
```typescript
{
  labelNumber: string;      // Required - Label number to scan (e.g., 'PO-00100100005')
  status: string;          // Required - 'SUKSES' (success) or 'GAGAL' (failed)
}
```

> **Note:** `createdBy` is automatically taken from the logged-in user via JWT token.

### POKAYOKE Validation Flow

| Step | Validation | Error Message |
|------|------------|---------------|
| 1 | LabelNumber exists in LabelData | LabelNumber {labelNumber} not found in system |
| 2 | LabelData.Scanned must be false | LabelNumber {labelNumber} already validated |
| 3 | Forecast exists (LabelData.ForecastId) | No Forecast/PO associated with LabelNumber |
| 4 | FinishGood exists (LabelData.FinishGoodId) | No FinishGood associated with LabelNumber |
| 5 | Create PokayokeScanHistory record | - |
| 6 | Update LabelData.Scanned = true | - |

### Response: PokayokeScanResponseDto
```typescript
{
  success: boolean;          // true if scan successful
  message: string;          // Status message
  data?: {
    id: number;            // PokayokeScanHistory ID
    labelNumber: string;    // Scanned label number
    poId: string;          // Forecast/PO ID
    partNumber: string;     // FinishGood PartNumber
    partName: string;       // FinishGood name
    status: string;        // 'SUKSES' or 'GAGAL'
    createdAt: Date;        // Scan timestamp
    createdBy: string;       // User who scanned
  };
}
```

### PokayokeScanQueryDto
```typescript
{
  page?: number;              // Optional - Page number (default: 1)
  limit?: number;             // Optional - Records per page (default: 50)
  labelNumber?: string;       // Optional - Filter by label number (partial match)
  poId?: string;             // Optional - Filter by Forecast/PO ID
  status?: string;           // Optional - Filter by status (SUKSES/GAGAL)
  createdBy?: string;         // Optional - Filter by creator (partial match)
}
```

### Example Requests

**Scan Label (POKAYOKE):**
```bash
POST /production/pokayoke/scan
{
  "labelNumber": "PO-00100100005",
  "status": "SUKSES"
}
```

**Get All Scan History:**
```bash
GET /production/pokayoke?page=1&limit=50
```

**Filter by Status:**
```bash
GET /production/pokayoke?status=SUKSES
```

**Response (Scan Success):**
```json
{
  "success": true,
  "message": "POKAYOKE scan successful for LabelNumber PO-00100100005",
  "data": {
    "id": 1,
    "labelNumber": "PO-00100100005",
    "poId": "PO-001",
    "partNumber": "FG-001",
    "partName": "Finish Good Alpha",
    "status": "SUKSES",
    "createdAt": "2026-06-09T14:30:00.000Z",
    "createdBy": "admin@vuteq.co.id"
  }
}
```

**Response (Scan - Already Validated):**
```json
{
  "statusCode": 400,
  "message": "POKAYOKE: LabelNumber PO-00100100005 already validated. Cannot scan again.",
  "error": "Bad Request"
}
```

**Paginated Response:**
```json
{
  "data": [
    {
      "id": 1,
      "labelNumber": "PO-00100100005",
      "poId": "PO-001",
      "partNumber": "FG-001",
      "partName": "Finish Good Alpha",
      "status": "SUKSES",
      "createdAt": "2026-06-09T14:30:00.000Z",
      "createdBy": "OPERATOR"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

**Notes:**
- When scanning, the system automatically marks the LabelData as Scanned
- Already scanned labels cannot be scanned again
- All scans are logged with detailed POKAYOKE validation steps

---

## 17. Delivery

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/production/delivery` | `DELIVERY_CREATE` | Create delivery with POKAYOKE validation |
| GET | `/production/delivery` | `DELIVERY_READ` | Get all delivery history (paginated) |

### CreateDeliveryDto
```typescript
{
  labelDataId: number;  // Required - Qty automatically taken from LabelData.QtyThisBox
}
```

> **Note:** Quantity is automatically taken from `LabelData.QtyThisBox`. No need to specify qty manually.

### POKAYOKE Validations

| Step | Validation | Error Message |
|------|------------|---------------|
| 1 | LabelData exists by ID | LabelData with ID {id} not found in system |
| 2 | LabelData.Scanned = true | LabelData has not been validated by POKAYOKE scan yet |
| 3 | ForecastId valid | No Forecast/PO associated with LabelData |
| 4 | Shopping complete (all materials picked) | Shopping for Forecast {poId} is not complete |
| 5 | ProductionRelease.Status = RELEASED | Production Release is in "{status}" status |

### On Success Actions
1. Create `DeliveryHistory` record (Qty from `LabelData.QtyThisBox`)
2. Update `FinishGood.Qty` (increment by `LabelData.QtyThisBox`)
3. Create `InventoryLedger` entry (DELIVERY_TO_CUSTOMER)

### DeliveryQueryDto
```typescript
{
  page?: number;              // Optional - Page number (default: 1)
  limit?: number;             // Optional - Records per page (default: 50)
  forecastId?: string;         // Optional - Filter by Forecast/PO ID
  createdBy?: string;         // Optional - Filter by creator (partial match)
}
```

### Response: DeliveryResponseEntity
```typescript
{
  success: boolean;           // true if delivery successful
  message: string;           // Status message
  data: {
    id: number;              // Delivery record ID
    forecastId: string;      // Forecast/PO ID
    qty: number;            // Quantity delivered
    createdAt: Date;         // Timestamp
    createdBy: string;       // User who created
    labelDataId: string;    // Associated LabelData ID
  };
}
```

### Example Requests

**Create Delivery:**
```bash
POST /production/delivery
{
  "labelDataId": 1
}
```

**Get All Deliveries:**
```bash
GET /production/delivery?page=1&limit=50
```

**Filter by Forecast:**
```bash
GET /production/delivery?forecastId=PO-001
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Delivery successful for LabelNumber PO-00100100005",
  "data": {
    "id": 1,
    "forecastId": "PO-001",
    "qty": 100,
    "createdAt": "2026-06-09T14:30:00.000Z",
    "createdBy": "admin@vuteq.co.id",
    "labelDataId": "1"
  }
}
```

**Response (POKAYOKE Failed - Not Scanned):**
```json
{
  "statusCode": 400,
  "message": "POKAYOKE 2: LabelData PO-00100100005 has not been validated by POKAYOKE scan yet. Please scan the part tag first.",
  "error": "Bad Request"
}
```

**Paginated Response:**
```json
{
  "data": [
    {
      "id": 1,
      "forecastId": "PO-001",
      "qty": 100,
      "createdAt": "2026-06-09T14:30:00.000Z",
      "createdBy": "admin@vuteq.co.id",
      "labelDataId": "1"
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

**Notes:**
- All deliveries are logged with detailed POKAYOKE validation steps
- Stock is automatically updated in FinishGood table
- InventoryLedger is created for audit trail

---

## Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Validation error |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error - Server error |

---

## Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "partNumber",
      "message": "partNumber must be a string"
    }
  ]
}
```

---

## Authentication Flow

1. **Login** - POST to `/auth/login` with username and password
2. **Get Token** - Receive JWT access token in response
3. **Use Token** - Include token in all subsequent requests:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Login Request
```bash
POST /auth/login
{
  "username": "admin",
  "password": "tambun123"
}
```

### Login Response
```json
{
  "AccessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "User": {
    "UserId": "admin",
    "Name": "Administrator",
    "Email": "irfan@vuteq.co.id",
    "RoleName": "SUPER"
  }
}
```
---

## Inventory Counting (Stock Opname)

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/inventory-counting` | `INVENTORY_COUNTING_CREATE` | Create new inventory counting |
| GET | `/inventory-counting` | `INVENTORY_COUNTING_READ` | Get all inventory counting (paginated) |
| GET | `/inventory-counting/:id` | `INVENTORY_COUNTING_READ` | Get inventory counting by ID |
| GET | `/inventory-counting/:id/details` | `INVENTORY_COUNTING_READ` | Get all details for inventory counting |
| PATCH | `/inventory-counting/:id` | `INVENTORY_COUNTING_UPDATE` | Update inventory counting notes |
| DELETE | `/inventory-counting/:id` | `INVENTORY_COUNTING_DELETE` | Delete inventory counting (DRAFT only) |
| POST | `/inventory-counting/:id/start` | `INVENTORY_COUNTING_UPDATE` | Start inventory counting (change status to IN_PROGRESS) |
| POST | `/inventory-counting/generate-cutoff` | `INVENTORY_COUNTING_CREATE` | Generate cut-off items for inventory counting |
| PATCH | `/inventory-counting/details/:detailId` | `INVENTORY_COUNTING_UPDATE` | Update actual stock for a detail item |
| POST | `/inventory-counting/close` | `INVENTORY_COUNTING_UPDATE` | Close inventory counting session |
| POST | `/inventory-counting/generate-ws` | `INVENTORY_COUNTING_READ` | Generate Worksheet Excel file |
| POST | `/inventory-counting/generate-snapshot` | `INVENTORY_COUNTING_READ` | Generate Snapshot Excel file |

---

### DTOs

#### CreateInventoryCountingDto
```typescript
{
  opnameNumber: string;           // Required - Unique opname number
  category: 'MATERIAL' | 'FINISH_GOOD';  // Required - Item category
  notes?: string;                 // Optional - Additional notes
}
```

#### UpdateInventoryCountingDto
```typescript
{
  notes?: string;                // Optional - Updated notes
}
```

#### GenerateCutOffDto
```typescript
{
  inventoryCountingId: string;    // Required - StockOpname ID
  itemCategory: 'MATERIAL' | 'FINISH_GOOD';  // Required - Category to generate
  location?: string;              // Optional - Specific location
  notes?: string;                // Optional - Additional notes
}
```

#### UpdateActualStockDto
```typescript
{
  actualQty: number;              // Required - Actual stock quantity (min: 0)
  actualQtyRack?: number;        // Optional - Actual stock at Rack (MATERIAL only, min: 0)
  notes?: string;                 // Optional - Notes for this item
}
```

#### CloseInventoryCountingDto
```typescript
{
  id: string;                    // Required - Inventory counting ID to close
}
```

#### InventoryCountingQueryDto
```typescript
{
  status?: OpnameStatus;         // Optional - Filter by status (DRAFT, IN_PROGRESS, COMPLETED, CANCELLED)
  category?: string;              // Optional - Filter by category
  createdBy?: string;             // Optional - Filter by creator
  page?: number;                  // Optional - Page number (default: 1)
  limit?: number;                // Optional - Items per page (default: 50)
}
```

---

### Entity/Response

#### InventoryCountingEntity
```typescript
{
  id: string;                    // StockOpname UUID
  opnameNumber: string;          // Unique opname number
  category: 'MATERIAL' | 'FINISH_GOOD';  // Item category
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';  // Status
  createdAt: Date;               // Creation timestamp
  createdBy: string;             // Creator username
  startedAt: Date | null;        // Start timestamp (when IN_PROGRESS)
  completedAt: Date | null;      // Completion timestamp
  completedBy: string | null;    // User who completed
  notes: string | null;          // Additional notes
  details?: InventoryCountingDetailEntity[];  // List of items
  totalItems?: number;           // Total items to count
  completedItems?: number;       // Items with actualQty filled
}
```

#### InventoryCountingDetailEntity
```typescript
{
  id: number;                    // Detail ID (auto-increment)
  opnameId: string;             // Parent StockOpname ID
  materialId: string | null;   // Material PartNumber (if MATERIAL)
  finishGoodId: string | null;  // FinishGood PartNumber (if FINISH_GOOD)
  location: string;             // Storage location
  systemQty: number;            // System stock at snapshot time (QtyWarehouse or Qty for FG)
  systemQtyRack: number | null; // System stock at Rack (MATERIAL only, = QtyRack)
  actualQty: number | null;     // Actual counted quantity (WAREHOUSE/FINISH_GOOD_AREA)
  actualQtyRack: number | null; // Actual counted quantity at Rack (MATERIAL RACK only)
  diffQty: number | null;       // Difference (actualQty - systemQty)
  diffQtyRack: number | null;   // Difference at Rack (actualQtyRack - systemQtyRack)
  notes: string | null;          // Notes for this item
}
```

#### InventoryCountingResponseEntity
```typescript
{
  success: boolean;             // Operation success status
  processId: string;             // Log process ID
  data: InventoryCountingEntity; // Created/updated inventory counting
}
```

#### InventoryCountingRemoveResponseEntity
```typescript
{
  success: boolean;             // Operation success status
  processId: string;            // Log process ID
  message: string;               // Deletion message
}
```

#### GenerateCutOffResponseEntity
```typescript
{
  success: boolean;              // Operation success status
  processId: string;             // Log process ID
  data: {
    inventoryCountingId: string; // StockOpname ID
    count: number;               // Number of cut-off items generated
  };
}
```

#### PaginatedInventoryCountingEntity
```typescript
{
  data: InventoryCountingEntity[];  // List of inventory countings
  total: number;                     // Total count
  page: number;                      // Current page
  limit: number;                     // Items per page
  totalPages: number;                // Total pages
}
```

---

### Example Requests

#### Create Inventory Counting
```bash
POST /inventory-counting
{
  "opnameNumber": "INV-2025-001",
  "category": "MATERIAL",
  "notes": "Monthly stock opname"
}
```

#### Response
```json
{
  "success": true,
  "processId": "PR202506110000001",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "opnameNumber": "INV-2025-001",
    "category": "MATERIAL",
    "status": "DRAFT",
    "createdAt": "2025-06-11T10:00:00.000Z",
    "createdBy": "admin",
    "startedAt": null,
    "completedAt": null,
    "completedBy": null,
    "notes": "Monthly stock opname"
  }
}
```

#### Start Inventory Counting
```bash
POST /inventory-counting/123e4567-e89b-12d3-a456-426614174000/start
```

**Effect:**
- Takes snapshot of current stock into SystemQty/SystemQtyRack
  - MATERIAL WAREHOUSE: SystemQty = QtyWarehouse
  - MATERIAL RACK: SystemQty = QtyRack, SystemQtyRack = QtyRack
  - FINISH_GOOD: SystemQty = Qty
- Changes status to IN_PROGRESS
- Sets StartedAt timestamp

**Response:**
```json
{
  "success": true,
  "processId": "PR202506110000002",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "opnameNumber": "INV-2025-001",
    "status": "IN_PROGRESS",
    "startedAt": "2025-06-11T10:05:00.000Z",
    "details": [
      {
        "id": 1,
        "materialId": "MAT-001",
        "location": "WAREHOUSE",
        "systemQty": 100,
        "systemQtyRack": 50,
        "actualQty": null,
        "actualQtyRack": null
      }
    ]
  }
}
```

#### Generate Cut-off Items
```bash
POST /inventory-counting/generate-cutoff
{
  "inventoryCountingId": "123e4567-e89b-12d3-a456-426614174000",
  "itemCategory": "MATERIAL",
  "location": "WAREHOUSE"
}
```

#### Response
```json
{
  "success": true,
  "processId": "PR202506110000002",
  "data": {
    "inventoryCountingId": "123e4567-e89b-12d3-a456-426614174000",
    "count": 25
  }
}
```

#### Update Actual Stock
```bash
PATCH /inventory-counting/details/1
{
  "actualQty": 95,
  "actualQtyRack": 48,
  "notes": "Counted manually, found 5 items damaged"
}
```

**Note:** For MATERIAL with Location=RACK, include both `actualQty` and `actualQtyRack`.

#### Response
```json
{
  "success": true,
  "processId": "PR202506110000003",
  "data": {
    "Id": 1,
    "OpnameId": "123e4567-e89b-12d3-a456-426614174000",
    "MaterialId": "MAT-001",
    "FinishGoodId": null,
    "Location": "WAREHOUSE",
    "SystemQty": 100,
    "SystemQtyRack": 50,
    "ActualQty": 95,
    "ActualQtyRack": 48,
    "DiffQty": -5,
    "DiffQtyRack": -2,
    "Notes": "Counted manually, found 5 items damaged"
  }
}
```

#### Close Inventory Counting
```bash
POST /inventory-counting/close
{
  "id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Effect:**
- Validates ALL items have ActualQty filled (ActualQtyRack for MATERIAL RACK)
- Sets stock to actual values:
  - MATERIAL WAREHOUSE: QtyWarehouse = ActualQty
  - MATERIAL RACK: QtyRack = ActualQtyRack
  - FINISH_GOOD: Qty = ActualQty
- Creates InventoryLedger entries for audit
- Changes status to COMPLETED
- Sets CompletedAt and CompletedBy

#### Response
```json
{
  "success": true,
  "processId": "PR202506110000004",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "opnameNumber": "INV-2025-001",
    "category": "MATERIAL",
    "status": "COMPLETED",
    "createdAt": "2025-06-11T10:00:00.000Z",
    "createdBy": "admin",
    "startedAt": "2025-06-11T10:05:00.000Z",
    "completedAt": "2025-06-11T12:00:00.000Z",
    "completedBy": "admin",
    "notes": "Monthly stock opname",
    "totalItems": 25,
    "completedItems": 25
  }
}
```

#### Generate Worksheet (Excel)
```bash
POST /inventory-counting/generate-ws
{
  "id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:** Excel file download (`Inventory_Worksheet_{id}.xlsx`)

Worksheet contains:
- Items grouped by location
- Columns: No, Part Number, Part Name, Location, System Qty, Pallet (Full), Pieces, Actual Qty
- Empty Actual Qty cells highlighted in yellow for easy identification
- Protected worksheet with editable Actual Qty column

#### Generate Snapshot (Excel)
```bash
POST /inventory-counting/generate-snapshot
{
  "id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:** Excel file download (`Inventory_Snapshot_{id}.xlsx`)

Snapshot contains:
- All items with System Qty, Actual Qty, and Diff
- Summary row with totals
- Diff values highlighted in red if non-zero
- Formatted for reporting purposes

---

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INVENTORY COUNTING WORKFLOW                               │
└─────────────────────────────────────────────────────────────────────────────┘

1. CREATE → DRAFT
   POST /inventory-counting
   └── Creates header only (no items yet)

2. GENERATE CUT-OFF
   POST /inventory-counting/generate-cutoff
   └── Creates StockOpnameDetail records with SystemQty=0 (placeholder)
   └── If status is DRAFT, auto-starts and snapshots system qty

3. START → IN_PROGRESS (with snapshot)
   POST /inventory-counting/:id/start
   └── Takes snapshot of current stock:
 - MATERIAL WAREHOUSE: SystemQty = QtyWarehouse
       - MATERIAL RACK: SystemQty = QtyRack, SystemQtyRack = QtyRack
       - FINISH_GOOD: SystemQty = Qty
   └── Changes status to IN_PROGRESS
   └── Sets StartedAt timestamp

4. UPDATE ACTUAL STOCK
   PATCH /inventory-counting/details/:detailId
   └── Enter actual quantity counted
   └── For MATERIAL RACK: include both actualQty and actualQtyRack
   └── DiffQty = ActualQty - SystemQty (auto-calculated)
   └── DiffQtyRack = ActualQtyRack - SystemQtyRack (auto-calculated)

5. CLOSE → COMPLETED
   POST /inventory-counting/close
   └── Validates ALL items have ActualQty (and ActualQtyRack for MATERIAL RACK)
   └── Sets stock to actual values:
       - MATERIAL WAREHOUSE: QtyWarehouse = ActualQty
       - MATERIAL RACK: QtyRack = ActualQtyRack
       - FINISH_GOOD: Qty = ActualQty
   └── Creates InventoryLedger entries for audit
   └── Updates status to COMPLETED
   └── Sets CompletedAt and CompletedBy

6. EXPORT (Optional - Can be done anytime after START)
   POST /inventory-counting/generate-ws
   └── Downloads Worksheet Excel for manual counting

   POST /inventory-counting/generate-snapshot
   └── Downloads Snapshot Excel for reporting
```

### Status Flow

```
DRAFT → IN_PROGRESS → COMPLETED
   │         │
   │         └── (can be cancelled if needed)
   │
   └── (can be deleted)
```

### Stock Update Logic

| Category | Location | Stock Field | Source | On Close |
|----------|----------|-------------|--------|----------|
| MATERIAL | WAREHOUSE | QtyWarehouse | SystemQty | QtyWarehouse = ActualQty |
| MATERIAL | RACK | QtyRack | SystemQtyRack | QtyRack = ActualQtyRack |
| FINISH_GOOD | FINISH_GOOD_AREA | Qty | SystemQty | Qty = ActualQty |

---

## 21. Transfer Material (Surat Jalan Material)

Material Delivery Note for material transfer to subcont or other locations.

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/transfer-material` | `TRANSFER_MATERIAL_CREATE` | Create draft delivery note |
| GET | `/transfer-material` | `TRANSFER_MATERIAL_READ` | List all delivery notes (paginated) |
| GET | `/transfer-material/:id` | `TRANSFER_MATERIAL_READ` | Get one delivery note |
| GET | `/transfer-material/:id/details` | `TRANSFER_MATERIAL_READ` | Get delivery note details |
| PATCH | `/transfer-material/:id` | `TRANSFER_MATERIAL_UPDATE` | Update header (DRAFT only) |
| DELETE | `/transfer-material/:id` | `TRANSFER_MATERIAL_DELETE` | Delete (DRAFT only) |
| PATCH | `/transfer-material/:id/pick` | `TRANSFER_MATERIAL_UPDATE` | Pick material (operator) |
| POST | `/transfer-material/:id/ship` | `TRANSFER_MATERIAL_UPDATE` | Ship with stock cut |
| POST | `/transfer-material/:id/receive` | `TRANSFER_MATERIAL_UPDATE` | Confirm receipt |
| POST | `/transfer-material/:id/cancel` | `TRANSFER_MATERIAL_UPDATE` | Cancel (DRAFT only) |

### CreateMaterialDeliveryNoteDto
```typescript
{
  destination: string;      // Required - Destination/location
  notes?: string;           // Optional - Notes/reason
  items: [
    {
      materialId: string;   // Required - Material PartNumber
      qtyRequested: number;  // Required - Requested quantity (min: 1)
    }
  ];
}
```

### PickMaterialDto
```typescript
{
  items: [
    {
      materialId: string;   // Required - Material PartNumber
      qtyPicking: number;   // Required - Picked quantity
    }
  ];
}
```

### MaterialDeliveryNoteEntity
```typescript
{
  Id: string;
  DeliveryNoteNum: string;       // Format: SJ-MAT/YYYY/MM/XXXX
  Destination: string;
  Status: 'DRAFT' | 'SHIPPED' | 'RECEIVED' | 'CANCELLED';
  Notes: string | null;
  CreatedAt: Date;
  CreatedBy: string;
  ShippedAt: Date | null;
  ShippedBy: string | null;
  ReceivedAt: Date | null;
  ReceivedBy: string | null;
  Details: [
    {
      Id: number;
      DeliveryNoteId: string;
      MaterialId: string;
      QtyRequested: number;
      QtyPicking: number;
      QtyReceived: number | null;
      MaterialData: {
        PartNumber: string;
        PartName: string;
        QtyWarehouse: number;
        QtyRack: number;
      };
    }
  ];
}
```

### Example Requests

**Create Draft:**
```bash
POST /transfer-material
{
  "destination": "Gudang Subcont A",
  "notes": "Transfer untuk produksi outsourcing",
  "items": [
    { "materialId": "MAT-001", "qtyRequested": 100 },
    { "materialId": "MAT-002", "qtyRequested": 50 }
  ]
}
```

**Response:**
```json
{
  "Id": "uuid-1234",
  "DeliveryNoteNum": "SJ-MAT/2026/06/0001",
  "Destination": "Gudang Subcont A",
  "Status": "DRAFT",
  "Notes": "Transfer untuk produksi outsourcing",
  "CreatedAt": "2026-06-11T10:00:00Z",
  "CreatedBy": "admin",
  "ShippedAt": null,
  "ShippedBy": null,
  "ReceivedAt": null,
  "ReceivedBy": null,
  "Details": [
    {
      "Id": 1,
      "MaterialId": "MAT-001",
      "QtyRequested": 100,
      "QtyPicking": 0,
      "QtyReceived": null
    },
    {
      "Id": 2,
      "MaterialId": "MAT-002",
      "QtyRequested": 50,
      "QtyPicking": 0,
      "QtyReceived": null
    }
  ]
}
```

**Pick Material (Operator):**
```bash
PATCH /transfer-material/uuid-1234/pick
{
  "items": [
    { "materialId": "MAT-001", "qtyPicking": 100 },
    { "materialId": "MAT-002", "qtyPicking": 50 }
  ]
}
```

**Ship (with stock cut):**
```bash
POST /transfer-material/uuid-1234/ship
```

**Confirm Receipt:**
```bash
POST /transfer-material/uuid-1234/receive
```

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MATERIAL DELIVERY NOTE WORKFLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

1. CREATE → DRAFT
   POST /transfer-material
   └── Creates header with auto-generated DeliveryNoteNum
   └── Creates detail items with QtyRequested and QtyPicking = 0

2. PICK (Operator Shopping)
   PATCH /transfer-material/:id/pick
   └── Updates QtyPicking for each material
   └── POKAYOKE: QtyPicking ≤ QtyRequested
   └── POKAYOKE: QtyPicking ≤ QtyWarehouse (stock check)

3. SHIP → SHIPPED
   POST /transfer-material/:id/ship
   └── POKAYOKE: Status must be DRAFT
   └── POKAYOKE: All QtyPicking = QtyRequested
   └── POKAYOKE: Stock sufficient for all items
   └── Reduces Material.QtyWarehouse for each item
   └── Creates InventoryLedger entry (MATERIAL_OUT_DELIVERY)
   └── Sets ShippedAt and ShippedBy

4. RECEIVE → RECEIVED
   POST /transfer-material/:id/receive
   └── POKAYOKE: Status must be SHIPPED
   └── Sets ReceivedAt and ReceivedBy
   └── (No stock change - stock already cut at SHIP)
```

### Status Flow

```
DRAFT → SHIPPED → RECEIVED
   │         │
   │         └── (can be cancelled if needed - but no stock reversal)
   │
   └── (can be updated, deleted, or cancelled)
```

### POKAYOKE Validations

| Step | Validation | Error Message |
|------|------------|---------------|
| Pick | QtyPicking ≤ QtyRequested | "Qty picking tidak boleh lebih dari qty requested untuk {materialId}" |
| Pick | QtyPicking ≤ QtyWarehouse | "Stock tidak cukup untuk picking material {materialId}. Available: {stock}" |
| Ship | Status = DRAFT | "Cannot ship - delivery note status is {status}" |
| Ship | All QtyPicking = QtyRequested | "Qty picking harus sama dengan qty requested sebelum kirim" |
| Ship | Stock sufficient | "Stock tidak cukup untuk {materialId}. Needed: {needed}, Available: {available}" |
| Receive | Status = SHIPPED | "Cannot receive - delivery note status is {status}" |

### InventoryLedger Entry (on Ship)

| Field | Value |
|-------|-------|
| ItemCategory | MATERIAL |
| MaterialId | PartNumber |
| Location | WAREHOUSE |
| TransactionType | MATERIAL_OUT_DELIVERY |
| ReferenceDoc | SJ-MAT/YYYY/MM/XXXX |
| QtyOut | QtyPicking |
| BalanceAfter | QtyWarehouse - QtyOut |

### Permissions Required

```
TRANSFER_MATERIAL_READ
TRANSFER_MATERIAL_CREATE
TRANSFER_MATERIAL_UPDATE
TRANSFER_MATERIAL_DELETE
```

---

## 25. MRP (Material Requirements Planning)

MRP module provides Material Requirements Planning calculations including current stock levels, pending incoming orders, and demand forecasts.

### Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/mrp/calculate` | `MRP_READ` | Calculate MRP for all materials |

### Calculate MRP

Calculate MRP (Material Requirements Planning) for all materials. Returns:
- Current stock levels (QtyRack, QtyWarehouse)
- Pending incoming quantities from open orders
- Demand forecast for 7 days (today + H+1 to H+6)
- Lack calculation (stock shortage if demand exceeds current stock)

### Date Range

The endpoint returns forecast for 7 days:
- **Today** + **H+1** to **H+6** (6 future working days)
- Standard MRP planning horizon for short-term material planning

### MrpCalculateResponse

```typescript
{
  calculatedAt: string;        // ISO timestamp
  dateRange: {
    today: string;             // YYYY-MM-DD
    startDate: string;         // YYYY-MM-DD
    endDate: string;           // YYYY-MM-DD
  };
  materials: MrpMaterialResponse[];
}
```

### MrpMaterialResponse

```typescript
{
  materialId: number;          // Material ID
  partNumber: string;          // Part number
  partName: string;            // Part name
  supplier: string | null;     // Supplier name
  rackLocation: string | null;  // Rack location
  qtyRack: number;             // Current quantity in rack
  qtyWarehouse: number;        // Current quantity in warehouse
  qtyPending: number;          // Pending from Incoming (Closed=false)
  qtyCurrentTotal: number;     // QtyRack + QtyWarehouse + QtyPending
  dailyDemand: MrpDayDemand[];  // 7 days forecast
}
```

### MrpDayDemand

```typescript
{
  date: string;    // YYYY-MM-DD
  demand: number;  // Material demand on this date
  lack: number;    // QtyCurrentTotal - cumulative demand (up to 2 days before)
}
```

### Example Request

**Calculate MRP:**
```bash
POST /mrp/calculate
```

### Example Response

```json
{
  "calculatedAt": "2026-06-18T12:00:00.000Z",
  "dateRange": {
    "today": "2026-06-18",
    "startDate": "2026-06-19",
    "endDate": "2026-06-24"
  },
  "materials": [
    {
      "materialId": 1,
      "partNumber": "MAT-001",
      "partName": "Material A",
      "supplier": "Supplier A",
      "rackLocation": "A-01",
      "qtyRack": 100,
      "qtyWarehouse": 50,
      "qtyPending": 25,
      "qtyCurrentTotal": 175,
      "dailyDemand": [
        { "date": "2026-06-18", "demand": 0, "lack": 0 },
        { "date": "2026-06-19", "demand": 0, "lack": 0 },
        { "date": "2026-06-20", "demand": 0, "lack": 0 },
        { "date": "2026-06-21", "demand": 0, "lack": 0 },
        { "date": "2026-06-22", "demand": 0, "lack": 0 },
        { "date": "2026-06-23", "demand": 0, "lack": 0 },
        { "date": "2026-06-24", "demand": 0, "lack": 0 }
      ]
    }
  ]
}
```

### Calculation Logic

#### QtyPending
Sum of `IncomingMaterial.Qty` where `Incoming.Closed = false`

#### QtyCurrentTotal
```
QtyRack + QtyWarehouse + QtyPending
```

#### Demand Calculation
For each date, demand is calculated based on:
1. Find all FinishGoods that use this Material (via BillOfMaterials)
2. For each FinishGood, find Forecasts with DeliveryDate on that date
3. Only include Forecasts without DeliveryHistory (not yet delivered)
4. Material demand = Sum of (Forecast.Qty × BOM.Qty)

#### Lack Calculation
```
Lack = max(0, Demand - QtyCurrentTotal)
```

**Examples:**
- Stock = 175, Demand = 30 → Lack = 0 (stock cukup)
- Stock = 175, Demand = 200 → Lack = 25 (stock kurang 25 unit)

### Permissions Required

```
MRP_READ
```

### Audit Logging

This endpoint logs process via `LogProcess` and `LogProcessDetail`:
- FunctionId: `MRP_001`
- FunctionName: `MrpService.calculate`
- CreatedBy: `SYSTEM`
