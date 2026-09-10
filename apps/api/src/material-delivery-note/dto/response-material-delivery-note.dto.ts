import { ApiProperty } from '@nestjs/swagger';
import { DeliveryNoteStatus } from '../../generated/prisma/enums';

export class MaterialResponseDto {
  @ApiProperty({ example: 'PN-001' })
  PartNumber: string;

  @ApiProperty({ example: 'Part Name Example' })
  PartName: string;

  @ApiProperty({ example: 100 })
  QtyWarehouse: number;

  @ApiProperty({ example: 50 })
  QtyRack: number;
}

export class MaterialDeliveryNoteDetailResponseDto {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiProperty({ example: 'uuid-here' })
  DeliveryNoteId: string;

  @ApiProperty({ example: 'PN-001' })
  MaterialId: string;

  @ApiProperty({ example: 100 })
  QtyRequested: number;

  @ApiProperty({ example: 100 })
  QtyPicking: number;

  @ApiProperty({ example: 95, nullable: true })
  QtyReceived: number | null;

  @ApiProperty({ type: MaterialResponseDto, nullable: true })
  MaterialData: MaterialResponseDto | null;
}

export class MaterialDeliveryNoteResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  Id: string;

  @ApiProperty({ example: 'DN-2026-001' })
  DeliveryNoteNum: string;

  @ApiProperty({ example: 'Warehouse A' })
  Destination: string;

  @ApiProperty({ enum: DeliveryNoteStatus, example: DeliveryNoteStatus.DRAFT })
  Status: DeliveryNoteStatus;

  @ApiProperty({ example: 'Delivery note for production line', nullable: true })
  Notes: string | null;

  @ApiProperty({ example: '2026-07-20T08:00:00.000Z' })
  CreatedAt: Date;

  @ApiProperty({ example: 'admin' })
  CreatedBy: string;

  @ApiProperty({ example: '2026-07-20T10:00:00.000Z', nullable: true })
  ShippedAt: Date | null;

  @ApiProperty({ example: 'operator', nullable: true })
  ShippedBy: string | null;

  @ApiProperty({ example: '2026-07-20T12:00:00.000Z', nullable: true })
  ReceivedAt: Date | null;

  @ApiProperty({ example: 'receiver', nullable: true })
  ReceivedBy: string | null;

  @ApiProperty({ type: [MaterialDeliveryNoteDetailResponseDto] })
  Details: MaterialDeliveryNoteDetailResponseDto[];
}

export class PaginatedMaterialDeliveryNoteResponseDto {
  @ApiProperty({ type: [MaterialDeliveryNoteResponseDto] })
  data: MaterialDeliveryNoteResponseDto[];

  @ApiProperty({ example: { total: 100, page: 1, limit: 10, totalPages: 10 } })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class DeleteMaterialDeliveryNoteResponseDto {
  @ApiProperty({ example: true })
  deleted: boolean;

  @ApiProperty({ example: 'uuid-here' })
  id: string;
}

export class CancelMaterialDeliveryNoteResponseDto {
  @ApiProperty({ example: true })
  cancelled: boolean;

  @ApiProperty({ example: 'uuid-here' })
  id: string;
}

export class PickMaterialResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'DN-2026-001' })
  deliveryNoteNum: string;

  @ApiProperty({ example: 'PICKED' })
  status: DeliveryNoteStatus;

  @ApiProperty({ example: 'admin' })
  pickedBy: string;

  @ApiProperty({ example: '2026-07-20T09:00:00.000Z' })
  pickedAt: Date;

  @ApiProperty({ example: 5 })
  totalItems: number;
}

export class ShipMaterialDeliveryNoteResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'DN-2026-001' })
  deliveryNoteNum: string;

  @ApiProperty({ example: 'SHIPPED' })
  status: DeliveryNoteStatus;

  @ApiProperty({ example: 'admin' })
  shippedBy: string;

  @ApiProperty({ example: '2026-07-20T10:00:00.000Z' })
  shippedAt: Date;

  @ApiProperty({ example: 5 })
  totalItems: number;
}

export class ReceiveMaterialDeliveryNoteResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'DN-2026-001' })
  deliveryNoteNum: string;

  @ApiProperty({ example: 'RECEIVED' })
  status: DeliveryNoteStatus;

  @ApiProperty({ example: 'admin' })
  receivedBy: string;

  @ApiProperty({ example: '2026-07-20T12:00:00.000Z' })
  receivedAt: Date;
}
