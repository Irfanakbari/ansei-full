/* By Irfan Akbari Vuteq Indonesia - 2026-10-07 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class CandidatePartEntity {
  @ApiProperty() PartNumber: string;
  @ApiProperty() PartName: string;
}

class CandidateEntity {
  @ApiProperty() PoId: string;
  @ApiProperty() FinishGoodId: string;
  @ApiProperty() Qty: number;
  @ApiProperty({ type: String, format: 'date-time' }) DeliveryDate: Date;
  @ApiProperty() DeliveryPeriod: number;
  @ApiPropertyOptional({ type: String, nullable: true }) ProductionReleaseId:
    string | null;
  @ApiProperty({ type: CandidatePartEntity }) PartData: CandidatePartEntity;
}

class CandidatePaginationEntity {
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalItems: number;
  @ApiProperty() totalPages: number;
}

export class ForecastCandidatesEntity {
  @ApiProperty({ type: [CandidateEntity] }) data: CandidateEntity[];
  @ApiProperty({ type: CandidatePaginationEntity })
  meta: CandidatePaginationEntity;
}

export class ForecastCandidateIdsEntity {
  @ApiProperty({
    type: [String],
    description:
      'Snapshot of every eligible PO ID matching the filters, without pagination',
  })
  forecastIds: string[];
  @ApiProperty({
    type: [String],
    description: 'All eligible demand IDs matching the current filters',
  })
  demandIds: string[];
  @ApiProperty() total: number;
}
