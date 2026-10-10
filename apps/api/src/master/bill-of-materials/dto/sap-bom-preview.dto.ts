/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ApiProperty } from '@nestjs/swagger';
import type { SapBomResult } from '../../../common/sap/sap-bom.service';

class SapBomLineDto {
  @ApiProperty() LineNumber: number;
  @ApiProperty() ItemCode: string;
  @ApiProperty() Quantity: number;
  @ApiProperty({ type: String, nullable: true }) WarehouseName: string | null;
  @ApiProperty({ type: String, nullable: true }) Warehouse: string | null;
  @ApiProperty({ type: String, nullable: true }) ItemType: string | null;
}
class SapBomDto {
  @ApiProperty() TreeCode: string;
  @ApiProperty() Quantity: number;
  @ApiProperty({ type: String, nullable: true }) ProductDescription:
    string | null;
  @ApiProperty({ type: [SapBomLineDto] }) ProductTreeLines: SapBomLineDto[];
}
export class SapBomPreviewDto {
  @ApiProperty() finishGoodId: number;
  @ApiProperty() partNumber: string;
  @ApiProperty({ type: String, nullable: true }) sapPartNumber: string | null;
  @ApiProperty({
    enum: ['FOUND', 'NOT_FOUND', 'UNKNOWN', 'DISABLED', 'UNMAPPED'],
  })
  status: SapBomResult['status'];
  @ApiProperty({ type: String, nullable: true }) checkedAt: string | null;
  @ApiProperty() stale: boolean;
  @ApiProperty({ type: SapBomDto, nullable: true }) bom: SapBomDto | null;
}
