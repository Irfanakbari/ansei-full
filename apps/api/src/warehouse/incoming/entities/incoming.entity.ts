/**
 * Supplier Entity - For Incoming response
 */
export interface SupplierEntity {
  Id: number;
  Name: string;
}

/**
 * Material Entity - For IncomingMaterial response
 */
export interface MaterialEntity {
  Id: number;
  PartNumber: string;
  PartName: string;
}

/**
 * IncomingMaterial Entity - Incoming material items response format
 */
export interface IncomingMaterialEntity {
  Id: number;
  IncomingId: string | null;
  MaterialId: number | null;
  Qty: number;
  QtyChecked: number;
  CreatedAt: Date;
  MaterialData: MaterialEntity | null;
}

/**
 * Incoming Entity - Incoming header response format
 */
export interface IncomingEntity {
  Id: string;
  PoId: string;
  Description: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
  ReceivedBy: string;
  ReceivedByName?: string;
  ApprovedAt: Date | null;
  Closed: boolean;
  ApprovedBy: string | null;
  ApprovedByName?: string | null;
  SupplierId: number;
  SupplierData: SupplierEntity;
  IncomingMaterial: IncomingMaterialEntity[];
}

/**
 * Incoming Receive Result - Result after receiving incoming
 */
export interface IncomingReceiveResult {
  id: string;
  poId: string;
  status: string;
  approvedAt: Date;
  totalItems: number;
  totalQty: number;
  inventoryUpdated: boolean;
}

/**
 * Incoming Check Result - Result after checking incoming materials
 */
export interface IncomingCheckResult {
  id: string;
  poId: string;
  status: string;
  checkedAt: Date;
  checkedBy: string;
  totalItems: number;
  materialsChecked: Array<{
    incomingMaterialId: number;
    materialId: number | null;
    partNumber: string;
    qtyExpected: number;
    qtyChecked: number;
  }>;
}
