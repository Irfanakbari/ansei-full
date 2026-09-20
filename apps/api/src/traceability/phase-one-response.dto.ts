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
  @ApiProperty() ForecastId: string;
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
export class NgCaseResponseDto {
  @ApiProperty() Id: string;
  @ApiProperty() CaseNumber: string;
  @ApiProperty() ForecastId: string;
  @ApiProperty() ReleaseId: string;
  @ApiProperty() SnapshotId: string;
  @ApiProperty() Stage: string;
  @ApiProperty() Reason: string;
  @ApiProperty({ enum: ['OPEN', 'FULFILLED', 'CLOSED', 'CANCELLED'] })
  Status: string;
  @ApiProperty() CreatedBy: string;
  @ApiProperty({ format: 'date-time' }) CreatedAt: string;
  @ApiProperty({ nullable: true, type: String }) ClosedBy: string | null;
  @ApiProperty({ nullable: true, type: String }) CloseReason: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) ClosedAt:
    string | null;
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'MaterialNG details with SnapshotLine and Replacements shopping records',
  })
  Details: Record<string, unknown>[];
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  Snapshot?: Record<string, unknown>;
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
  @ApiProperty() ForecastId: string;
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
  @ApiProperty() materialNg: number;
  @ApiProperty() replacementIssued: number;
  @ApiProperty() totalIssued: number;
  @ApiProperty() remainingReplacement: number;
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
  @ApiProperty({ type: [NgCaseResponseDto] }) cases: NgCaseResponseDto[];
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
