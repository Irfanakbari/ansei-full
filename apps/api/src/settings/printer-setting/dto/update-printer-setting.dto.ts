import { PartialType } from '@nestjs/swagger';
import { CreatePrinterSettingDto } from './create-printer-setting.dto';

export class UpdatePrinterSettingDto extends PartialType(
  CreatePrinterSettingDto,
) {}
