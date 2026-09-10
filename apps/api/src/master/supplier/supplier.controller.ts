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
import { SupplierService } from './supplier.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';
import { SupplierEntity } from './entities/supplier.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('Supplier')
@Controller('master/supplier')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @ApiOperation({ summary: 'Get all suppliers' })
  @ApiResponse({ status: 200, type: [SupplierEntity] })
  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(@CurrentUser() _user: ICurrentUser) {
    return this.supplierService.findAll();
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
