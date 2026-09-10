import { PartialType } from '@nestjs/swagger';
import { CreateManPowerDto } from './create-man-power.dto';

export class UpdateManPowerDto extends PartialType(CreateManPowerDto) {}
