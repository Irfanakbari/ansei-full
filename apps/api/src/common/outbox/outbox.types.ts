import type { PartTagAnseiPayload } from '../printer/printer.types';

export const OUTBOX_QUEUE = 'outbox_queue';
export const DISPATCH_OUTBOX_EVENT = 'dispatchOutboxEvent';

export interface DeliveryNoteEmailPayload {
  deliveryNoteId: string;
  documentVersion: string;
  to: string[];
  cc: string[];
  sentBy: string;
  subject?: string;
  message?: string;
}

export interface PalletConnectorHistoryPayload {
  kode: string;
  deliveryId: number;
}

export interface InventoryCountingPackagePayload {
  inventoryCountingId: string;
  actor: string;
}

export interface InventoryCountingPackageEmailPayload {
  inventoryCountingId: string;
  recipients: string[];
  actor: string;
  subject?: string;
  message?: string;
}

export interface SapMaterialUpdatePayload {
  materialId: number;
  itemCode: string;
  partName: string;
  minimumStock: number;
  maximumStock: number;
}

export type OutboxPayload =
  | SapMaterialUpdatePayload
  | PartTagAnseiPayload
  | DeliveryNoteEmailPayload
  | PalletConnectorHistoryPayload
  | InventoryCountingPackagePayload
  | InventoryCountingPackageEmailPayload;

export interface OutboxJobPayload {
  eventId: string;
  attempt: number;
}

export interface SafeOutboxEvent {
  id: string;
  type: string;
  status: string;
  completionEvidence:
    | 'NOT_COMPLETED'
    | 'TRANSPORT_ACCEPTED'
    | 'MANUAL_CONFIRMATION'
    | 'LEGACY_UNVERIFIED'
    | 'SAP_APPLIED'
    | 'SUPERSEDED';
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date;
  error: { code: string; message: string } | null;
  createdAt: Date;
  updatedAt: Date;
  succeededAt: Date | null;
  failedAt: Date | null;
  referenceType: string | null;
  referenceId: string | null;
}
