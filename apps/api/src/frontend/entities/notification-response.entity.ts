import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationForecastEntity {
  @ApiProperty()
  poId: string;

  @ApiProperty()
  poNumber: string;

  @ApiPropertyOptional({ nullable: true })
  partNumber: string | null;

  @ApiPropertyOptional({ nullable: true })
  partName: string | null;

  @ApiProperty()
  qty: number;

  @ApiProperty()
  deliveryDate: Date;
}

export class NotificationProductionReleaseEntity {
  @ApiProperty()
  releaseId: string;

  @ApiProperty()
  releaseNumber: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  count: number;

  @ApiProperty({ type: [NotificationForecastEntity] })
  forecasts: NotificationForecastEntity[];
}

export class IncomingNotificationEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  poId: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  receivedBy: string | null;

  @ApiPropertyOptional({ nullable: true })
  supplierName?: string;

  @ApiProperty()
  createdAt: Date;
}

export class StockOpnameNotificationEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  opnameNumber: string;

  @ApiProperty()
  category: string;

  @ApiPropertyOptional({ nullable: true })
  startedAt: Date | null;
}

export class PokayokeNotificationEntity {
  @ApiProperty()
  id: number;

  @ApiProperty()
  labelNumber: string;

  @ApiPropertyOptional({ nullable: true })
  releaseId: string | null;

  @ApiPropertyOptional({ nullable: true })
  releaseNumber?: string;
}

export class AssemblyNotificationEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  labelNumber: string;

  @ApiProperty()
  finishGoodId: string;

  @ApiPropertyOptional({ nullable: true })
  releaseId: string | null;

  @ApiPropertyOptional({ nullable: true })
  releaseNumber: string | null;

  @ApiProperty()
  startedAt: Date;
}

export class NotificationMessageEntity {
  @ApiProperty()
  menu: string;

  @ApiProperty()
  message: string;
}

export class NotificationResponseEntity {
  @ApiProperty()
  totalPOWithoutAttachment: number;

  @ApiProperty({ type: [NotificationProductionReleaseEntity] })
  byProductionRelease: NotificationProductionReleaseEntity[];

  @ApiProperty()
  totalIncomingNotClosed: number;

  @ApiProperty({ type: [IncomingNotificationEntity] })
  incomingNotClosed: IncomingNotificationEntity[];

  @ApiProperty()
  totalStockOpnameInProgress: number;

  @ApiProperty({ type: [StockOpnameNotificationEntity] })
  stockOpnameInProgress: StockOpnameNotificationEntity[];

  @ApiProperty()
  totalLabelDataNotScanned: number;

  @ApiProperty({ type: [PokayokeNotificationEntity] })
  labelDataNotScanned: PokayokeNotificationEntity[];

  @ApiProperty()
  totalAssemblyInProgress: number;

  @ApiProperty({ type: [AssemblyNotificationEntity] })
  assemblyInProgress: AssemblyNotificationEntity[];

  @ApiProperty({ type: [NotificationMessageEntity] })
  messages: NotificationMessageEntity[];
}
