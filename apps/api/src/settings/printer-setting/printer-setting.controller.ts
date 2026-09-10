import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { PrinterSettingService } from './printer-setting.service';
import { CreatePrinterSettingDto, UpdatePrinterSettingDto } from './dto';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('PrinterSetting')
@Controller('settings/printer-setting')
export class PrinterSettingController {
  constructor(private readonly printerSettingService: PrinterSettingService) {}

  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(@CurrentUser() _user: ICurrentUser) {
    return this.printerSettingService.findAll();
  }

  @Get('ip/:ipAddress')
  @Permission('IPCS.MASTER_READ')
  async findByIpAddress(
    @Param('ipAddress') ipAddress: string,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.printerSettingService.findByIpAddress(ipAddress);
  }

  @Get(':id')
  @Permission('IPCS.MASTER_READ')
  async findOne(@Param('id') id: string, @CurrentUser() _user: ICurrentUser) {
    return this.printerSettingService.findOne(id);
  }

  @Post()
  @Permission('IPCS.MASTER_CREATE')
  async create(
    @Body() createPrinterSettingDto: CreatePrinterSettingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.printerSettingService.create(
      createPrinterSettingDto,
      user.username,
    );
  }

  @Patch(':id')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('id') id: string,
    @Body() updatePrinterSettingDto: UpdatePrinterSettingDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.printerSettingService.update(
      id,
      updatePrinterSettingDto,
      user.username,
    );
  }

  @Delete(':id')
  @Permission('IPCS.MASTER_DELETE')
  async remove(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    return this.printerSettingService.remove(id, user.username);
  }
}
