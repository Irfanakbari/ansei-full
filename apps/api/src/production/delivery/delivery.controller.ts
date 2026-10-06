import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { CreateDeliveryDto, DeliveryQueryDto } from './dto/create-delivery.dto';
import {
  DeliveryResponseEntity,
  PaginatedDeliveryEntity,
} from './entities/delivery.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('Delivery')
@Controller('production/delivery')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  @Permission('IPCS.DELIVERY_CREATE')
  @ApiOperation({
    summary: 'Create delivery with POKAYOKE validation',
  })
  @ApiResponse({ status: 201, type: DeliveryResponseEntity })
  @ApiResponse({
    status: 409,
    description:
      'An earlier delivery period in this production release is incomplete',
  })
  async create(
    @Body() dto: CreateDeliveryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.deliveryService.create(dto, user.username);
  }

  @Get('pallets')
  @Permission('IPCS.DELIVERY_READ')
  @ApiOperation({
    summary: 'Get active pallet options from connector API',
  })
  async getPalletOptions() {
    return this.deliveryService.getPalletOptions();
  }

  @Get()
  @Permission('IPCS.DELIVERY_READ')
  @ApiOperation({
    summary: 'Get all delivery history (paginated)',
  })
  @ApiResponse({ status: 200, type: PaginatedDeliveryEntity })
  async findAll(@Query() query: DeliveryQueryDto) {
    return this.deliveryService.findAll(query);
  }
}
