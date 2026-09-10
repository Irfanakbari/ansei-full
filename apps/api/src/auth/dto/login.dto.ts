import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  /** Username untuk login */
  @ApiProperty({ description: 'Username untuk login', example: 'admin' })
  @IsString()
  @IsNotEmpty()
  username: string;

  /** Password user */
  @ApiProperty({ description: 'Password user', example: 'P@ssw0rd123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
