import {
  ApiTags,
  ApiBearerAuth,
  ApiProduces,
  ApiResponse,
} from '@nestjs/swagger';
import { Controller, Post, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MrpService } from './mrp.service';
import { Permission } from '../auth/decorators/permission.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('MRP')
@Controller('mrp')
export class MrpController {
  constructor(private readonly mrpService: MrpService) {}

  /**
   * Calculate MRP (Material Requirements Planning)
   * Returns current stock levels, pending incoming, and demand forecast for all materials
   */
  @Post('calculate')
  @Permission('IPCS.MRP_READ')
  @ApiResponse({ status: 200, description: 'MRP calculation result' })
  async calculate() {
    return this.mrpService.calculate();
  }

  /**
   * Export MRP data to Excel file
   * Returns Excel file with merged headers, subheaders, and printable format
   */
  @Post('export')
  @Public()
  // @Permission('IPCS.MRP_READ')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  @ApiResponse({ status: 200, description: 'Excel file download' })
  async exportToExcel(@Res() res: Response): Promise<void> {
    const { buffer, filename } = await this.mrpService.exportToExcel();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.end(buffer);
  }
}
