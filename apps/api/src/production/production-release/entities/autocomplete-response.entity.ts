import { ApiProperty } from '@nestjs/swagger';

export class RequestAutocompleteOtpResponseEntity {
  @ApiProperty({
    description: 'Unique challenge ID for the verification step',
    format: 'uuid',
  })
  challengeId: string;

  @ApiProperty({
    description: 'Approver full name',
    example: 'Manager Produksi',
  })
  approverName: string;

  @ApiProperty({
    description: 'Masked WhatsApp phone number OTP was dispatched to',
    example: '62812****7890',
  })
  maskedPhoneNumber: string;

  @ApiProperty({
    description: 'Seconds until OTP challenge expires',
    example: 300,
  })
  expiresInSeconds: number;
}

export class ExecuteAutocompleteResponseEntity {
  @ApiProperty({ description: 'Release ID' })
  releaseId: string;

  @ApiProperty({ description: 'Release Number' })
  releaseNumber: string;

  @ApiProperty({ description: 'Final Status', example: 'COMPLETED' })
  status: string;

  @ApiProperty({ description: 'Total production minutes recorded' })
  totalProductionMinutes: number;

  @ApiProperty({ description: 'Total demands processed' })
  demandsProcessed: number;

  @ApiProperty({ description: 'Total shopping picks completed' })
  shoppingPicksCompleted: number;

  @ApiProperty({ description: 'Total assembly sessions completed' })
  assemblySessionsCompleted: number;

  @ApiProperty({ description: 'Total pokayoke scans completed' })
  pokayokeScanned: number;

  @ApiProperty({ description: 'Total deliveries created' })
  deliveriesCreated: number;

  @ApiProperty({ description: 'Completion message' })
  message: string;
}
