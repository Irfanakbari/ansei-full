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
  Patch,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { BillOfMaterialsService } from './bill-of-materials.service';
import { CreateBillOfMaterialsDto, UpdateBillOfMaterialsDto } from './dto';
import { BillOfMaterialsEntity } from './entities/bill-of-materials.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('BillOfMaterials')
@Controller('master/bill-of-materials')
export class BillOfMaterialsController {
  constructor(
    private readonly billOfMaterialsService: BillOfMaterialsService,
  ) {}

  @ApiOperation({ summary: 'Get all bill of materials' })
  @ApiResponse({ status: 200, type: [BillOfMaterialsEntity] })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(@CurrentUser() _user: ICurrentUser) {
    return this.billOfMaterialsService.findAll();
  }

  // IMPORTANT: Specific routes MUST come before parameterized routes
  @ApiOperation({ summary: 'Get BOM by material ID' })
  @ApiResponse({ status: 200, type: [BillOfMaterialsEntity] })
  @Get('material/:materialId')
  @Permission('IPCS.MASTER_READ')
  async findByMaterialId(
    @Param('materialId', ParseIntPipe) materialId: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.billOfMaterialsService.findByMaterialId(materialId);
  }

  @ApiOperation({ summary: 'Get BOM by finish good ID' })
  @ApiResponse({ status: 200, type: [BillOfMaterialsEntity] })
  @Get(':finishGoodId')
  @Permission('IPCS.MASTER_READ')
  async findByFinishGoodId(
    @Param('finishGoodId', ParseIntPipe) finishGoodId: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.billOfMaterialsService.findByFinishGoodId(finishGoodId);
  }

  @ApiOperation({ summary: 'Create new BOM entry' })
  @ApiResponse({ status: 201, type: BillOfMaterialsEntity })
  @Post()
  @Permission('IPCS.MASTER_CREATE')
  async create(
    @Body() createBillOfMaterialsDto: CreateBillOfMaterialsDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.billOfMaterialsService.create(
      createBillOfMaterialsDto,
      user.username,
    );
  }

  @ApiOperation({ summary: 'Update BOM entry' })
  @ApiResponse({ status: 200, type: BillOfMaterialsEntity })
  @ApiResponse({ status: 404, description: 'BOM tidak ditemukan' })
  @Patch(':id')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBillOfMaterialsDto: UpdateBillOfMaterialsDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.billOfMaterialsService.update(
      id,
      updateBillOfMaterialsDto,
      user.username,
    );
  }

  @ApiOperation({ summary: 'Delete BOM entry' })
  @ApiResponse({ status: 200, description: 'BOM berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'BOM tidak ditemukan' })
  @Delete(':id')
  @Permission('IPCS.MASTER_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.billOfMaterialsService.remove(id, user.username);
  }
}
