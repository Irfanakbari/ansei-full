import { PartialType } from '@nestjs/swagger';
import { CreateBoxQtyDto } from './create-box-qty.dto';

export class UpdateBoxQtyDto extends PartialType(CreateBoxQtyDto) {}
