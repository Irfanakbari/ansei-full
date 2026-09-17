import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DisplayTargetQueryDto {
  @ApiProperty({
    description: 'Finish good part number shown on the production display',
    example: 'FG-001',
  })
  @IsString()
  @IsNotEmpty()
  partNumber: string;
}
