/* By Irfan Akbari Vuteq Indonesia - 2026-09-18 */
import { ApiProperty } from '@nestjs/swagger';
import { AssemblyStatus } from '../../../generated/prisma/enums';
class AssemblyPartEntity {
  @ApiProperty() PartName: string;
}
export class AssemblyLabelEntity {
  @ApiProperty() LabelNumber: string;
  @ApiProperty() FinishGoodId: string;
  @ApiProperty() ProductionDemandId: string;
  @ApiProperty({ nullable: true }) ProductionReleaseId: string | null;
  @ApiProperty() QtyThisBox: number;
  @ApiProperty({ type: AssemblyPartEntity }) PartData: AssemblyPartEntity;
}
export class AssemblySessionEntity {
  @ApiProperty({ format: 'uuid' }) Id: string;
  @ApiProperty() LabelDataId: number;
  @ApiProperty() ManPowerUid: string;
  @ApiProperty() ManPowerName: string;
  @ApiProperty({ enum: AssemblyStatus }) Status: AssemblyStatus;
  @ApiProperty({ type: String, format: 'date-time' }) StartedAt: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  EndedAt: Date | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  CancelledAt: Date | null;
  @ApiProperty({ nullable: true }) CancelledBy: string | null;
  @ApiProperty({ nullable: true }) CancelReason: string | null;
  @ApiProperty() CreatedBy: string;
  @ApiProperty({ nullable: true }) CompletedBy: string | null;
  @ApiProperty() Channel: string;
  @ApiProperty() StartRequestId: string;
  @ApiProperty({ nullable: true }) CompleteRequestId: string | null;
  @ApiProperty({ type: AssemblyLabelEntity }) LabelData: AssemblyLabelEntity;
}
export class AssemblyOperatorEntity {
  @ApiProperty() active: boolean;
  @ApiProperty({ type: AssemblySessionEntity, nullable: true })
  session: AssemblySessionEntity | null;
  @ApiProperty({ format: 'date-time' }) serverTime: string;
}
export class AssemblyProgressEntity {
  @ApiProperty() waitingShopping: number;
  @ApiProperty() ready: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() completed: number;
  @ApiProperty() notRequired: number;
}

class AssemblyAvailableManpowerEntity {
  @ApiProperty() Nik: string;
  @ApiProperty() Name: string;
}
export class AssemblyCreateOptionsEntity {
  @ApiProperty({ type: [AssemblyLabelEntity] }) labels: AssemblyLabelEntity[];
  @ApiProperty({ type: [AssemblyAvailableManpowerEntity] })
  manpower: AssemblyAvailableManpowerEntity[];
}
