import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryEntity {
  @ApiProperty({
    description: 'Total active materials (IsActive = true)',
    example: 150,
  })
  totalMaterials: number;

  @ApiProperty({
    description: 'Total suppliers',
    example: 25,
  })
  totalSuppliers: number;

  @ApiProperty({
    description: 'Total finish goods',
    example: 45,
  })
  totalFinishGoods: number;

  @ApiProperty({
    description: 'Total active manpower (Status = true)',
    example: 30,
  })
  totalManPower: number;

  @ApiProperty({
    description:
      'Total incoming quantity this month (sum of IncomingMaterial.Qty)',
    example: 5000,
  })
  totalIncomingQty: number;

  @ApiProperty({
    description:
      'Total delivery quantity this month (sum of DeliveryHistory.Qty)',
    example: 3500,
  })
  totalDeliveryQty: number;
}

export class DailyForecastStatEntity {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2026-07-15',
  })
  date: string;

  @ApiProperty({
    description: 'Number of forecasts/deliveries on this day',
    example: 5,
  })
  count: number;

  @ApiProperty({
    description: 'Total quantity planned for delivery on this day',
    example: 500,
  })
  totalQty: number;
}

export class DailyIncomingStatEntity {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2026-07-15',
  })
  date: string;

  @ApiProperty({
    description: 'Total incoming quantity on this day',
    example: 250,
  })
  totalQty: number;
}

export class DailyDeliveryStatEntity {
  @ApiProperty({
    description: 'Date in YYYY-MM-DD format',
    example: '2026-07-15',
  })
  date: string;

  @ApiProperty({
    description: 'Total delivery quantity on this day',
    example: 300,
  })
  totalQty: number;
}

export class DashboardResponseEntity {
  @ApiProperty({
    description: 'Summary statistics',
    type: DashboardSummaryEntity,
  })
  summary: DashboardSummaryEntity;

  @ApiProperty({
    description:
      'Daily forecast statistics for current month (every day of the month)',
    type: [DailyForecastStatEntity],
  })
  forecastDailyStats: DailyForecastStatEntity[];

  @ApiProperty({
    description:
      'Daily incoming statistics for current month (every day of the month)',
    type: [DailyIncomingStatEntity],
  })
  incomingDailyStats: DailyIncomingStatEntity[];

  @ApiProperty({
    description:
      'Daily delivery statistics for current month (every day of the month)',
    type: [DailyDeliveryStatEntity],
  })
  deliveryDailyStats: DailyDeliveryStatEntity[];

  @ApiProperty({
    description: 'Current month in YYYY-MM format',
    example: '2026-07',
  })
  currentMonth: string;

  @ApiProperty({
    description: 'Number of days in current month',
    example: 31,
  })
  daysInMonth: number;
}
