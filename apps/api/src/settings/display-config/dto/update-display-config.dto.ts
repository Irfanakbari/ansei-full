import { PartialType } from '@nestjs/swagger';
import { CreateDisplayConfigDto } from './create-display-config.dto';

export class UpdateDisplayConfigDto extends PartialType(
  CreateDisplayConfigDto,
) {}
