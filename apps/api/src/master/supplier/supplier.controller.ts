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
  Put,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { SupplierService } from './supplier.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  UpsertSupplierBarcodeFormatDto,
} from './dto';
import { SupplierEntity } from './entities/supplier.entity';
import { SupplierBarcodeFormatEntity } from './entities/supplier-barcode-format.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';
import { ApiSuccessEnvelope } from '../../common/interceptors/api-response.swagger';

@ApiTags('Supplier')
@Controller('master/supplier')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @ApiOperation({ summary: 'Get supplier barcode format' })
  @ApiResponse({
    status: 200,
    type: SupplierBarcodeFormatEntity,
    description: 'Returns null when the supplier has no barcode format',
  })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  @Get(':id/barcode-format')
  @Permission('IPCS.SUPPLIER_BARCODE_FORMAT_READ')
  async getBarcodeFormat(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.supplierService.getBarcodeFormat(id);
  }

  @ApiOperation({ summary: 'Create or update supplier barcode format' })
  @ApiResponse({ status: 200, type: SupplierBarcodeFormatEntity })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  @Put(':id/barcode-format')
  @Permission('IPCS.MASTER_UPDATE')
  async upsertBarcodeFormat(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertSupplierBarcodeFormatDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.supplierService.upsertBarcodeFormat(id, dto, user.username);
  }

  @ApiOperation({ summary: 'Get all suppliers' })
  @ApiSuccessEnvelope({
    status: 200,
    type: SupplierEntity,
    isArray: true,
    paginated: true,
  })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(
    @Query() query: SearchPaginationQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.supplierService.findAll(query);
  }

  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiResponse({ status: 200, type: SupplierEntity })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  @Get(':id')
  @Permission('IPCS.MASTER_READ')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.supplierService.findOne(id);
  }

  @ApiOperation({ summary: 'Create new supplier' })
  @ApiResponse({ status: 201, type: SupplierEntity })
  @Post()
  @Permission('IPCS.MASTER_CREATE')
  async create(
    @Body() createSupplierDto: CreateSupplierDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.supplierService.create(createSupplierDto, user.username);
  }

  @ApiOperation({ summary: 'Update supplier' })
  @ApiResponse({ status: 200, type: SupplierEntity })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  @Patch(':id')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.supplierService.update(id, updateSupplierDto, user.username);
  }

  @ApiOperation({ summary: 'Delete supplier' })
  @ApiResponse({ status: 200, description: 'Supplier berhasil dihapus' })
  @ApiResponse({ status: 404, description: 'Supplier tidak ditemukan' })
  @Delete(':id')
  @Permission('IPCS.MASTER_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.supplierService.remove(id, user.username);
  }
}
