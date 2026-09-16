import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartType } from '../../../generated/prisma/enums';

export class ProductionReportEntity {
  @ApiProperty() id: number;
  @ApiPropertyOptional() date: string | null;
  @ApiPropertyOptional() time: string | null;
  @ApiProperty() productionStamp: Date;
  @ApiProperty() ngQty: number;
  @ApiPropertyOptional() startTime: string | null;
  @ApiPropertyOptional() startStamp: Date | null;
  @ApiPropertyOptional() endTime: string | null;
  @ApiPropertyOptional() endStamp: Date | null;
  @ApiProperty() stopMinute: number;
  @ApiPropertyOptional() latchDate: string | null;
  @ApiPropertyOptional() cableHDate: string | null;
  @ApiPropertyOptional() cableLDate: string | null;
  @ApiPropertyOptional() coverDate: string | null;
  @ApiPropertyOptional() rodDate: string | null;
  @ApiPropertyOptional() sponsDate: string | null;
  @ApiPropertyOptional() sponsRearDate: string | null;
  @ApiPropertyOptional() clipDate: string | null;
  @ApiPropertyOptional() leverDate: string | null;
  @ApiPropertyOptional() smallPadDate: string | null;
  @ApiPropertyOptional() actuatorDate: string | null;
  @ApiPropertyOptional() backPlateDate: string | null;
  @ApiPropertyOptional() stampDate: string | null;
  @ApiPropertyOptional() poNumber: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional() validatedAt: Date | null;
  @ApiPropertyOptional() validatedBy: string | null;
  @ApiProperty({ enum: PartType }) recordType: PartType;
  @ApiProperty() qty: number;
  @ApiProperty() manPowerUid: string;
  @ApiProperty() finishGoodId: string;
  @ApiPropertyOptional() forecastId?: string | null;

  // Relations
  @ApiPropertyOptional() manPowerData?: {
    Uid: string;
    Nik: string;
    Name: string;
  };
  @ApiPropertyOptional() fgData?: {
    PartNumber: string;
    PartName: string;
  };
  @ApiPropertyOptional() forecastData?: {
    PoId: string;
    PoNumber: string;
    VendorName: string;
  };
}

export class PaginatedProductionReportDto {
  @ApiProperty({ type: [ProductionReportEntity] })
  data: ProductionReportEntity[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
