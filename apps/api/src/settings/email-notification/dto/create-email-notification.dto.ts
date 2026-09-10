import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { NotificationType } from '../../../generated/prisma/enums';

export class CreateEmailNotificationDto {
  /** Nama penerima notifikasi */
  @ApiProperty({ description: 'Nama penerima', example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Email penerima */
  @ApiProperty({ description: 'Email penerima', example: 'john@ansei.co.id' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Tipe notifikasi',
    enum: NotificationType,
    example: 'INCOMING',
  })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;
}
