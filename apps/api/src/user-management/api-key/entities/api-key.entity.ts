import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKeyUserInfo {
  @ApiProperty({ example: 'user001' })
  UserId: string;

  @ApiProperty({ example: 'John Doe' })
  Name: string;

  @ApiProperty({ example: 'john.doe@ansei.co.id' })
  Email: string;

  @ApiProperty({ example: true })
  IsActive: boolean;
}

export class ApiKeyEntity {
  @ApiProperty({ example: 'uuid-here' })
  Id: string;

  @ApiProperty({ example: 'HRIS Integration' })
  Name: string;

  @ApiProperty({
    example: 'ansei_api_',
    description: 'Key prefix for identification',
  })
  KeyPrefix: string;

  @ApiPropertyOptional({ example: 'API Key for HRIS system integration' })
  Description?: string;

  @ApiProperty({ example: 'user001' })
  UserId: string;

  @ApiProperty({ type: ApiKeyUserInfo })
  User: ApiKeyUserInfo;

  @ApiProperty({ example: true })
  IsActive: boolean;

  @ApiPropertyOptional({ example: '2026-01-15T10:00:00.000Z' })
  LastUsedAt?: Date;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  CreatedAt: Date;

  @ApiProperty({ example: 'admin' })
  CreatedBy: string;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  UpdatedAt: Date;

  @ApiProperty({ example: 'admin' })
  UpdatedBy: string;

  @ApiPropertyOptional({ example: 'Administrator' })
  CreatedByName?: string;
}

export class CreateApiKeyResponseEntity {
  @ApiProperty({ example: 'uuid-here' })
  Id: string;

  @ApiProperty({ example: 'HRIS Integration' })
  Name: string;

  @ApiProperty({
    example: 'ansei_api_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    description: 'Full API Key - SHOW ONLY ONCE!',
  })
  ApiKey: string;

  @ApiProperty({ example: 'ansei_api_' })
  KeyPrefix: string;

  @ApiProperty({ example: 'user001' })
  UserId: string;

  @ApiProperty({ example: '2026-01-15T10:00:00.000Z' })
  CreatedAt: Date;

  @ApiProperty({ example: 'admin' })
  CreatedBy: string;

  @ApiPropertyOptional({ example: 'Administrator' })
  CreatedByName?: string;
}
