import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PokayokeService } from './pokayoke.service';
import {
  CreatePokayokeScanDto,
  PokayokeScanOptionsQueryDto,
  PokayokeScanQueryDto,
} from './dto/pokayoke-scan.dto';
import {
  PaginatedPokayokeScanEntity,
  PokayokeScanOptionsEntity,
  PokayokeScanResponseEntity,
} from './entities/pokayoke.entity';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';

@ApiTags('Pokayoke')
@Controller('production/pokayoke')
export class PokayokeController {
  constructor(private readonly pokayokeService: PokayokeService) {}

  @Get('scan-options')
  @Permission('IPCS.POKAYOKE_CREATE')
  @ApiOperation({ summary: 'Get production-ready labels available to scan' })
  @ApiResponse({ status: 200, type: PokayokeScanOptionsEntity })
  async getScanOptions(@Query() query: PokayokeScanOptionsQueryDto) {
    return this.pokayokeService.getScanOptions(query);
  }

  @Post('scan')
  @Permission('IPCS.POKAYOKE_CREATE')
  @ApiOperation({
    summary: 'Scan label and perform POKAYOKE validation',
  })
  @ApiResponse({ status: 201, type: PokayokeScanResponseEntity })
  async scan(
    @Body() dto: CreatePokayokeScanDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.pokayokeService.scan(dto, user.username);
  }

  @Get()
  @Permission('IPCS.POKAYOKE_READ')
  @ApiOperation({
    summary: 'Get all POKAYOKE scan history (paginated)',
  })
  @ApiResponse({ status: 200, type: PaginatedPokayokeScanEntity })
  async findAll(@Query() query: PokayokeScanQueryDto) {
    return this.pokayokeService.findAll(query);
  }
}
