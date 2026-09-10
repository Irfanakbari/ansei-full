import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PreDeliveryService } from './pre-delivery.service';
import { PreDeliveryQueryDto } from './dto/pre-delivery-query.dto';
import {
  PaginatedPreDeliveryDto,
  PreDeliveryLabelDto,
} from './entities/pre-delivery.entity';
import { Permission } from '../../auth/decorators/permission.decorator';

@ApiTags('Pre-Delivery')
@Controller('production/pre-delivery')
export class PreDeliveryController {
  constructor(private readonly preDeliveryService: PreDeliveryService) {}

  @Get()
  @Permission('IPCS.PRE_DELIVERY_READ')
  @ApiOperation({
    summary: 'Get all label data for pre-delivery (read-only, paginated)',
  })
  @ApiResponse({ status: 200, type: PaginatedPreDeliveryDto })
  async findAll(@Query() query: PreDeliveryQueryDto) {
    return this.preDeliveryService.findAll(query);
  }

  @Get('summary')
  @Permission('IPCS.PRE_DELIVERY_READ')
  @ApiOperation({
    summary: 'Get summary statistics for pre-delivery dashboard',
  })
  @ApiResponse({ status: 200 })
  async getSummary(@Query() query: PreDeliveryQueryDto) {
    return this.preDeliveryService.getSummary(query.productionReleaseId);
  }

  @Get(':labeldata')
  @Permission('IPCS.PRE_DELIVERY_READ')
  @ApiOperation({
    summary: 'Get one label data by Label Number',
  })
  @ApiResponse({ status: 200, type: PreDeliveryLabelDto })
  async findOne(@Param('labeldata', ParseIntPipe) id: string) {
    return this.preDeliveryService.findOne(id);
  }
}
