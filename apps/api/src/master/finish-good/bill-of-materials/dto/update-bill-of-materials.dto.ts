import { PartialType } from '@nestjs/swagger';
import { CreateBillOfMaterialsDto } from './create-bill-of-materials.dto';

export class UpdateBillOfMaterialsDto extends PartialType(
  CreateBillOfMaterialsDto,
) {}
