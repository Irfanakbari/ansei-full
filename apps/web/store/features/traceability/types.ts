/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
export interface Page<T> {
    data: T[];
    meta: { page: number; limit: number; totalItems: number; totalPages: number };
}

export interface BomLine {
    Id: string;
    MaterialId: number;
    Qty: number;
    PartNumber: string;
    PartName: string;
    UnitName: string | null;
}

export interface BomRevision {
    Id: string;
    FinishGoodId: number;
    Revision: number;
    Status: "DRAFT" | "SUBMITTED" | "APPROVED" | "CANCELLED";
    Version: number;
    Reason: string;
    CreatedBy: string;
    CreatedByName?: string | null;
    LastEditedBy: string;
    UpdatedBy?: string | null;
    UpdatedByName?: string | null;
    CreatedAt: string;
    UpdatedAt: string;
    ApprovedAt: string | null;
    ApprovedBy: string | null;
    BaseRevisionId: string | null;
    FinishGood: {
        Id: number;
        PartNumber: string;
        PartName: string;
        ActiveBomRevisionId: string | null;
    };
    Lines: BomLine[];
    Events: {
        Id: string;
        Action: string;
        Actor: string;
        Reason: string;
        CreatedAt: string;
    }[];
    Snapshots: {
        Id: string;
        ForecastId: string;
        ReleaseId: string;
        Version: number;
        CreatedAt: string;
    }[];
}

export interface SnapshotLine {
    Id: string;
    MaterialId: number;
    PartNumber: string;
    PartName: string;
    UnitName: string | null;
    QtyPerUnit: number;
    RequiredQty: number;
}

export interface BomSnapshot {
    Id: string;
    ForecastId: string;
    ReleaseId: string;
    RevisionId: string;
    Version: number;
    TargetQty: number;
    CreatedAt: string;
    FinishGoodPartNumber: string;
    Revision: { Revision: number };
    Lines: SnapshotLine[];
}

export interface ShoppingRecord {
    Id: string;
    ForecastId: string | null;
    MaterialId: string;
    QtyPick: number;
    Purpose: string;
    Description: string | null;
    CreatedBy: string;
    CreatedByName?: string;
    CreatedAt: string;
}

export interface NgDetail {
    Id: number;
    MaterialId: string;
    Qty: number;
    ReplacementRequestedQty: number;
    Replacements: ShoppingRecord[];
    SnapshotLine?: SnapshotLine;
}

export interface NgCase {
    Id: string;
    CaseNumber: string;
    ForecastId: string;
    ReleaseId: string;
    Stage: string;
    Reason: string;
    Status: "OPEN" | "FULFILLED" | "CLOSED" | "CANCELLED";
    CreatedBy: string;
    CreatedByName?: string;
    CreatedAt: string;
    CloseReason: string | null;
    Details: NgDetail[];
    Snapshot: BomSnapshot;
}

export interface MaterialUsage {
    materialId: string;
    materialName: string;
    unitName: string | null;
    standardRequired: number;
    standardIssued: number;
    materialNg: number;
    replacementIssued: number;
    totalIssued: number;
    remainingReplacement: number;
}

export interface TraceSearchRow {
    PoId: string;
    PoNumber: string;
    FinishGoodId: string;
    Qty: number;
    PartData: { PartName: string };
    ProductionRelease: {
        Id: string;
        ReleaseNumber: string;
        Status: string;
    } | null;
}

export interface TraceEvent {
    Id: string;
    Type: string;
    SourceType: string;
    SourceId: string;
    Actor: string;
    actorName: string;
    documentReference: string;
    CorrelationId: string;
    ProcessId: string | null;
    CreatedAt: string;
}

export interface TraceData {
    forecast: TraceSearchRow;
    snapshot: BomSnapshot | null;
    materials: MaterialUsage[];
    shopping: ShoppingRecord[];
    cases: NgCase[];
    materialLotTracked: false;
    completeness: "LEGACY" | "DOCUMENT_LEVEL";
    relationLevel: "PO";
    labels: {
        Id: number;
        LabelNumber: string;
        Scanned: boolean;
        QtyThisBox: number;
        AssemblySessions: {
            Id: string;
            Status: string;
            StartedAt: string;
            EndedAt: string | null;
        }[];
        DeliveryHistory: {
            Id: number;
            Qty: number;
            PalletNumber?: string | null;
            CreatedAt: string;
        } | null;
    }[];
}

export interface CreateNgInput {
    requestId: string;
    forecastId: string;
    snapshotId: string;
    stage: string;
    reason: string;
    labelId?: number;
    assemblySessionId?: string;
    productionReportId?: number;
    lines: { materialId: string; qtyNg: number; qtyReplacement: number }[];
}
