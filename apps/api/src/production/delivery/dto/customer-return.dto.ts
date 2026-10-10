/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class CustomerReturnDto {
  @ApiProperty() @IsUUID() requestId: string;
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) quantity: number;
  @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(500) reason: string;
}
