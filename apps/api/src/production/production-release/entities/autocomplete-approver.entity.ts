import { ApiProperty } from '@nestjs/swagger';

export class AutocompleteApproverEntity {
  @ApiProperty({ description: 'Internal user ID', example: 'USR-001' })
  userId: string;

  @ApiProperty({ description: 'Full name', example: 'Manager Produksi' })
  name: string;

  @ApiProperty({ description: 'Role name', example: 'MANAGER' })
  roleName: string;

  @ApiProperty({
    description: 'Masked WhatsApp phone number',
    example: '62812****7890',
  })
  maskedPhoneNumber: string;
}
