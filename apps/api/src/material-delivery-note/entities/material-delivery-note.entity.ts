/**
 * Material Entity - For MaterialDeliveryNoteDetail response
 */
export interface MaterialEntity {
  PartNumber: string;
  PartName: string;
  QtyWarehouse: number;
  QtyRack: number;
}

/**
 * MaterialDeliveryNoteDetail Entity
 */
export interface MaterialDeliveryNoteDetailEntity {
  Id: number;
  DeliveryNoteId: string;
  MaterialId: string;
  FinishGoodPartTemp: string | null;
  QtyRequested: number;
  QtyPicking: number;
  QtyReceived: number | null;
  MaterialData: MaterialEntity | null;
}

/**
 * MaterialDeliveryNote Entity - Response format
 */
export interface MaterialDeliveryNoteEntity {
  Id: string;
  DeliveryNoteNum: string;
  Destination: string;
  Status: string;
  Notes: string | null;
  CreatedAt: Date;
  CreatedBy: string;
  CreatedByName?: string;
  ShippedAt: Date | null;
  ShippedBy: string | null;
  ShippedByName?: string | null;
  ReceivedAt: Date | null;
  ReceivedBy: string | null;
  ReceivedByName?: string | null;
  Details: MaterialDeliveryNoteDetailEntity[];
}

/**
 * Paginated Response for MaterialDeliveryNote List
 */
export interface PaginatedMaterialDeliveryNoteEntity {
  data: MaterialDeliveryNoteEntity[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Delete Response
 */
export interface DeleteMaterialDeliveryNoteResponse {
  deleted: boolean;
  id: string;
}

/**
 * Cancel Response
 */
export interface CancelMaterialDeliveryNoteResponse {
  cancelled: boolean;
  id: string;
}
