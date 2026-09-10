import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreDeliveryLabelDto {
  @ApiProperty() id: number;
  @ApiProperty() labelNumber: string;
  @ApiProperty() finishGoodId: string;
  @ApiPropertyOptional() finishGoodName: string | null;
  @ApiProperty() forecastId: string;
  @ApiPropertyOptional() vendorName: string | null;
  @ApiProperty() scanned: boolean;
  @ApiProperty() qtyThisBox: number;
  @ApiPropertyOptional() productionReleaseId: string | null;
  @ApiPropertyOptional() productionReleaseNumber: string | null;
  @ApiPropertyOptional() deliveryDate: Date | null;
}

export class PreDeliverySummaryDto {
  @ApiProperty() total: number;
  @ApiProperty() scanned: number;
  @ApiProperty() notScanned: number;
  @ApiProperty() percentage: number;
}

export class PaginatedPreDeliveryDto {
  @ApiProperty({ type: [PreDeliveryLabelDto] })
  data: PreDeliveryLabelDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
