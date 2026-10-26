import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAssemblyProcessSettingDto {
  @ApiProperty()
  @IsBoolean()
  bypassAllAssembly: boolean;

  @ApiProperty({ format: 'date-time' })
  @IsDateString({ strict: true })
  expectedUpdatedAt: string;

  @ApiProperty({ minLength: 3, maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
