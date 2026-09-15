import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';
import { DeliveryNoteStatus } from '../../generated/prisma/enums';

export class MaterialDeliveryNoteQueryDto extends SearchPaginationQueryDto {
  @ApiPropertyOptional({ enum: DeliveryNoteStatus })
  @IsOptional()
  @IsEnum(DeliveryNoteStatus)
  status?: DeliveryNoteStatus;
}
