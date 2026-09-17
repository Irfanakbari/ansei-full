import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class AmendProductionReleaseForecastsDto {
  @ApiProperty({ description: 'Forecast PO IDs', example: ['PO-001'] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  forecastIds: string[];

  @ApiProperty({ description: 'Reason for changing the release forecasts' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
