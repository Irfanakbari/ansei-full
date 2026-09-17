import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateFinishGoodDto } from './create-finish-good.dto';

export class UpdateFinishGoodDto extends PartialType(
  OmitType(CreateFinishGoodDto, ['qty'] as const),
) {}
