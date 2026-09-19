import { ShoppingQueryDto } from './dto/create-shopping.dto';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ShoppingService } from './shopping.service';
import { CreateShoppingDto } from './dto';
import {
  ShoppingEntity,
  ForecastPickingStatusEntity,
  CheckRequirementResponseEntity,
} from './entities/shopping.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

@ApiTags('Shopping')
@Controller('production/shopping')
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  @ApiOperation({ summary: 'Get all shopping pick records' })
  @ApiResponse({ status: 200, type: [ShoppingEntity] })
  @Get()
  @Permission('IPCS.SHOPPING_READ')
  async findAll(
    @Query() query: ShoppingQueryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.shoppingService.findAll(query);
  }

  @ApiOperation({ summary: 'Get shopping pick record by ID' })
  @ApiResponse({ status: 200, type: ShoppingEntity })
  @ApiResponse({ status: 404, description: 'Shopping record not found' })
  @Get(':id')
  @Permission('IPCS.SHOPPING_READ')
  async findOne(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.shoppingService.findOne(id);
  }

  @ApiOperation({ summary: 'Get shopping pick records by Forecast ID (PO ID)' })
  @ApiResponse({ status: 200, type: [ShoppingEntity] })
  @Get('forecast/:forecastId')
  @Permission('IPCS.SHOPPING_READ')
  async findByForecastId(
    @Param('forecastId') forecastId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.shoppingService.findByForecastId(forecastId);
  }

  @ApiOperation({
    summary: 'Get forecast picking status and progress per BOM material',
  })
  @ApiResponse({ status: 200, type: ForecastPickingStatusEntity })
  @ApiResponse({ status: 404, description: 'Forecast not found' })
  @Get('forecast/:forecastId/status')
  @Permission('IPCS.SHOPPING_READ')
  async getForecastPickingStatus(
    @Param('forecastId') forecastId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.shoppingService.getForecastPickingStatus(forecastId);
  }

  @Get('check-requirement/:forecastId')
  @Permission('IPCS.SHOPPING_READ')
  @ApiOperation({
    summary:
      'Check BOM requirements for a forecast (qtyNeeded, qtyPicked, qtyRemaining)',
  })
  @ApiResponse({ status: 200, type: CheckRequirementResponseEntity })
  @ApiResponse({ status: 404, description: 'Forecast not found' })
  async checkRequirement(
    @Param('forecastId') forecastId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.shoppingService.checkRequirement(forecastId);
  }

  @ApiOperation({ summary: 'Get shopping pick records by Material ID' })
  @ApiResponse({ status: 200, type: [ShoppingEntity] })
  @Get('material/:materialId')
  @Permission('IPCS.SHOPPING_READ')
  async findByMaterialId(
    @Param('materialId') materialId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.shoppingService.findByMaterialId(materialId);
  }

  @ApiOperation({
    summary:
      'Create new shopping pick record (performs inventory deduction and logs ledger)',
  })
  @ApiResponse({ status: 201, type: ShoppingEntity })
  @Post()
  @Permission('IPCS.SHOPPING_CREATE')
  async create(
    @Body() createShoppingDto: CreateShoppingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.shoppingService.create(createShoppingDto, user.username);
  }

  @ApiOperation({ summary: 'Delete shopping pick record' })
  @ApiResponse({
    status: 200,
    description: 'Shopping pick record deleted successfully',
    schema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean', example: true },
        id: { type: 'string', example: 'SHP-140626-001' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Shopping record not found' })
  @Delete(':id')
  @Permission('IPCS.SHOPPING_DELETE')
  async remove(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.shoppingService.remove(id, user.username);
  }
}
