import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SapDocumentSummary } from '../../../common/sap/sap-document-summary';

export class SupplierResponseDto {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiProperty({ example: 'PT Supplier Indonesia' })
  Name: string;
}

export class MaterialResponseDto {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiProperty({ example: 'PN-001' })
  PartNumber: string;

  @ApiProperty({ example: 'Part Name Example' })
  PartName: string;
}

export class IncomingMaterialResponseDto {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiProperty({ example: 'INC-160726-001', nullable: true })
  IncomingId: string | null;

  @ApiProperty({ example: 1, nullable: true })
  MaterialId: number | null;

  @ApiProperty({ example: 100 })
  Qty: number;

  @ApiProperty({ example: 0 })
  QtyChecked: number;

  @ApiProperty({ example: '2026-07-16T08:00:00.000Z' })
  CreatedAt: Date;

  @ApiProperty({ type: MaterialResponseDto, nullable: true })
  MaterialData: MaterialResponseDto | null;
}

export class IncomingResponseDto {
  @ApiPropertyOptional({ type: [SapDocumentSummary] })
  SAPDocuments?: SapDocumentSummary[];
  @ApiProperty({ example: 'INC-160726-001' })
  Id: string;

  @ApiProperty({ example: 'PO-2026-001' })
  PoId: string;

  @ApiProperty({ example: 'Incoming material from supplier', nullable: true })
  Description: string | null;

  @ApiProperty({ example: '2026-07-16T08:00:00.000Z' })
  CreatedAt: Date;

  @ApiProperty({ example: '2026-07-16T08:00:00.000Z' })
  UpdatedAt: Date;

  @ApiProperty({ example: 'admin' })
  ReceivedBy: string;

  @ApiProperty({ example: '2026-07-16T10:00:00.000Z', nullable: true })
  ApprovedAt: Date | null;

  @ApiProperty({ example: false })
  Closed: boolean;

  @ApiProperty({ example: 'admin', nullable: true })
  ApprovedBy: string | null;

  @ApiProperty({ example: 1 })
  SupplierId: number;

  @ApiProperty({ type: SupplierResponseDto })
  SupplierData: SupplierResponseDto;

  @ApiProperty({ type: [IncomingMaterialResponseDto] })
  IncomingMaterial: IncomingMaterialResponseDto[];
}

export class IncomingReceiveResultDto {
  @ApiProperty({ example: 'INC-160726-001' })
  id: string;

  @ApiProperty({ example: 'PO-2026-001' })
  poId: string;

  @ApiProperty({ example: 'APPROVED' })
  status: string;

  @ApiProperty({ example: '2026-07-16T10:00:00.000Z' })
  approvedAt: Date;

  @ApiProperty({ example: 5 })
  totalItems: number;

  @ApiProperty({ example: 500 })
  totalQty: number;

  @ApiProperty({ example: true })
  inventoryUpdated: boolean;
}

export class MaterialCheckedDto {
  @ApiProperty({ example: 1 })
  incomingMaterialId: number;

  @ApiProperty({ example: 1, nullable: true })
  materialId: number | null;

  @ApiProperty({ example: 'PN-001' })
  partNumber: string;

  @ApiProperty({ example: 100 })
  qtyExpected: number;

  @ApiProperty({ example: 100 })
  qtyChecked: number;
}

export class IncomingCheckResultDto {
  @ApiProperty({ example: 'INC-160726-001' })
  id: string;

  @ApiProperty({ example: 'PO-2026-001' })
  poId: string;

  @ApiProperty({ example: 'CHECKED' })
  status: string;

  @ApiProperty({ example: '2026-07-16T09:00:00.000Z' })
  checkedAt: Date;

  @ApiProperty({ example: 'admin' })
  checkedBy: string;

  @ApiProperty({ example: 5 })
  totalItems: number;

  @ApiProperty({ type: [MaterialCheckedDto] })
  materialsChecked: MaterialCheckedDto[];
}

export class AttachmentResponseDto {
  @ApiProperty({ example: 'PO-2026-001_16072026.pdf' })
  fileName: string;

  @ApiProperty({ example: '/incoming/INC-160726-001/PO-2026-001_16072026.pdf' })
  filePath: string;
}

export class DeleteResponseDto {
  @ApiProperty({ example: true })
  deleted: boolean;

  @ApiProperty({ example: 1 })
  id: number;
}
