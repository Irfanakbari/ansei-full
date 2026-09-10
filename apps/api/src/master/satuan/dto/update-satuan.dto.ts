import { PartialType } from '@nestjs/swagger';
import { CreateSatuanDto } from './create-satuan.dto';

export class UpdateSatuanDto extends PartialType(CreateSatuanDto) {}
