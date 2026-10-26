import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssemblyProcessSettingEntity {
  @ApiProperty({ example: 1 })
  Id: number;

  @ApiProperty({ default: false })
  BypassAllAssembly: boolean;

  @ApiPropertyOptional({ nullable: true })
  ChangeReason: string | null;

  @ApiProperty()
  UpdatedAt: Date;

  @ApiProperty()
  UpdatedBy: string;
}
