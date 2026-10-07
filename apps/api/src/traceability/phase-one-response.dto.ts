/* By Irfan Akbari Vuteq Indonesia - 2026-09-19 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BomLineResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() MaterialId: number;
  @ApiProperty() Qty: number;
  @ApiProperty() PartNumber: string;
  @ApiProperty() PartName: string;
  @ApiProperty({ nullable: true, type: String }) UnitName: string | null;
}
export class BomEventResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() Action: string;
  @ApiProperty() Actor: string;
  @ApiProperty() Reason: string;
  @ApiProperty() Version: number;
  @ApiProperty({ format: 'date-time' }) CreatedAt: string;
}
export class BomRevisionResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() FinishGoodId: number;
  @ApiProperty() Revision: number;
  @ApiProperty({ enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED'] })
  Status: string;
  @ApiProperty({ nullable: true, type: String }) BaseRevisionId: string | null;
  @ApiProperty() Reason: string;
  @ApiProperty() Version: number;
  @ApiProperty() CreatedBy: string;
  @ApiProperty() LastEditedBy: string;
  @ApiProperty({ format: 'date-time' }) CreatedAt: string;
  @ApiProperty({ format: 'date-time' }) UpdatedAt: string;
  @ApiProperty({ nullable: true, type: String }) SubmittedBy: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  SubmittedAt: string | null;
  @ApiProperty({ nullable: true, type: String }) ApprovedBy: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  ApprovedAt: string | null;
  @ApiProperty({ type: [BomLineResponseDto] }) Lines: BomLineResponseDto[];
  @ApiProperty({ type: [BomEventResponseDto] }) Events: BomEventResponseDto[];
  @ApiProperty({ type: 'object', additionalProperties: true })
  FinishGood: Record<string, unknown>;
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  Snapshots: Record<string, unknown>[];
}
export class BomComparisonResponseDto {
  @ApiProperty() materialId: number;
  @ApiProperty() partNumber: string;
  @ApiProperty() before: number;
  @ApiProperty() after: number;
  @ApiProperty({ enum: ['ADDED', 'REMOVED', 'CHANGED', 'UNCHANGED'] })
  change: string;
}
export class SnapshotLineResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() SnapshotId: string;
  @ApiProperty() MaterialId: number;
  @ApiProperty() QtyPerUnit: number;
  @ApiProperty() RequiredQty: number;
  @ApiProperty() PartNumber: string;
  @ApiProperty() PartName: string;
  @ApiProperty({ nullable: true, type: String }) UnitName: string | null;
}
export class SnapshotResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() ProductionDemandId: string;
  @ApiProperty() ReleaseId: string;
  @ApiProperty() RevisionId: string;
  @ApiProperty() Version: number;
  @ApiProperty({ nullable: true, type: String }) PreviousId: string | null;
  @ApiProperty() TargetQty: number;
  @ApiProperty() FinishGoodPartNumber: string;
  @ApiProperty() FinishGoodPartName: string;
  @ApiProperty() CreatedBy: string;
  @ApiProperty({ format: 'date-time' }) CreatedAt: string;
  @ApiProperty({ type: [SnapshotLineResponseDto] })
  Lines: SnapshotLineResponseDto[];
  @ApiProperty({ type: 'object', additionalProperties: true }) Revision: Record<
    string,
    unknown
  >;
}
export class TraceSearchResponseDto {
  @ApiProperty() PoId: string;
  @ApiProperty() PoNumber: string;
  @ApiProperty() FinishGoodId: string;
  @ApiProperty() Qty: number;
  @ApiProperty({ type: 'object', additionalProperties: true }) PartData: Record<
    string,
    unknown
  >;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  ProductionRelease: Record<string, unknown> | null;
}
export class TraceEventResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() ProductionDemandId: string;
  @ApiProperty({ nullable: true, type: String }) ReleaseId: string | null;
  @ApiProperty() Type: string;
  @ApiProperty() SourceType: string;
  @ApiProperty() SourceId: string;
  @ApiProperty() Actor: string;
  @ApiProperty() actorName: string;
  @ApiProperty() documentReference: string;
  @ApiProperty() CorrelationId: string;
  @ApiProperty({ nullable: true, type: String }) ProcessId: string | null;
  @ApiProperty({ format: 'date-time' }) CreatedAt: string;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  Metadata: Record<string, unknown> | null;
}
export class MaterialUsageResponseDto {
  @ApiProperty() materialId: string;
  @ApiProperty() materialName: string;
  @ApiProperty({ nullable: true, type: String }) unitName: string | null;
  @ApiProperty() standardRequired: number;
  @ApiProperty() standardIssued: number;
  @ApiProperty() totalIssued: number;
}
export class ProductionFindingShoppingResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() MaterialId: string;
  @ApiProperty() QtyPick: number;
  @ApiProperty() Purpose: string;
  @ApiProperty({ nullable: true, type: String }) Destination: string | null;
  @ApiProperty({ nullable: true, type: String }) Description: string | null;
  @ApiProperty({ format: 'date-time' }) CreatedAt: string;
}
export class ProductionFindingAllocationResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() Qty: number;
  @ApiProperty({ type: ProductionFindingShoppingResponseDto })
  Shopping: ProductionFindingShoppingResponseDto;
}
export class ProductionFindingSnapshotLineResponseDto {
  @ApiProperty() PartNumber: string;
  @ApiProperty() PartName: string;
  @ApiProperty({ nullable: true, type: String }) UnitName: string | null;
  @ApiProperty() QtyPerUnit: number;
}
export class ProductionFindingComponentResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty({ description: 'Required component quantity for the finding' })
  Qty: number;
  @ApiProperty({ type: ProductionFindingSnapshotLineResponseDto })
  SnapshotLine: ProductionFindingSnapshotLineResponseDto;
  @ApiProperty({ type: [ProductionFindingAllocationResponseDto] })
  Allocations: ProductionFindingAllocationResponseDto[];
}
export class ProductionFindingTraceResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() RecordNumber: string;
  @ApiProperty({ enum: ['FINISH_GOOD'] }) Category: 'FINISH_GOOD';
  @ApiProperty({
    enum: ['PENDING', 'WAITING_PART_CHANGE', 'COMPLETED', 'REJECTED'],
  })
  Status: string;
  @ApiProperty() Qty: number;
  @ApiProperty() Reason: string;
  @ApiProperty() Reporter: string;
  @ApiProperty({ format: 'date-time' }) SubmittedAt: string;
  @ApiProperty() ProductionDemandId: string;
  @ApiProperty({ nullable: true, type: String }) ReleaseId: string | null;
  @ApiProperty({ nullable: true, type: String }) SnapshotId: string | null;
  @ApiProperty({ nullable: true, type: Number }) LabelId: number | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  Label: Record<string, unknown> | null;
  @ApiProperty({ type: [ProductionFindingComponentResponseDto] })
  Components: ProductionFindingComponentResponseDto[];
}
export class TraceDetailResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true }) forecast: Record<
    string,
    unknown
  >;
  @ApiProperty({ type: SnapshotResponseDto, nullable: true })
  snapshot: SnapshotResponseDto | null;
  @ApiProperty({ type: [MaterialUsageResponseDto] })
  materials: MaterialUsageResponseDto[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  shopping: Record<string, unknown>[];
  @ApiProperty({ type: [ProductionFindingTraceResponseDto] })
  findings: ProductionFindingTraceResponseDto[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  labels: Record<string, unknown>[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  reports: Record<string, unknown>[];
  @ApiProperty({ enum: ['DOCUMENT_LEVEL', 'LEGACY'] }) completeness: string;
  @ApiProperty({ enum: [false] }) materialLotTracked: false;
  @ApiProperty({ enum: ['PO'] }) relationLevel: 'PO';
  @ApiProperty({ nullable: true, type: String }) legacyNotice: string | null;
}
