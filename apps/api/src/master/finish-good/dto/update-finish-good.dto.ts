import { PartialType } from '@nestjs/swagger';
import { CreateFinishGoodDto } from './create-finish-good.dto';

export class UpdateFinishGoodDto extends PartialType(CreateFinishGoodDto) {}
