import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ description: 'User ID', example: 'admin001' })
  UserId: string;

  @ApiProperty({ description: 'Nama user', example: 'Administrator' })
  Name: string;

  @ApiProperty({
    description: 'Email user',
    required: false,
    nullable: true,
    example: 'admin@ansei.co.id',
  })
  Email: string | null;

  @ApiProperty({ description: 'Nama role user', example: 'SUPER' })
  RoleName: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT Access Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  AccessToken: string;

  @ApiProperty({ description: 'Data profil user', type: UserProfileDto })
  User: UserProfileDto;
}
