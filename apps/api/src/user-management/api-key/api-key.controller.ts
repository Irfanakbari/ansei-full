import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyService } from './api-key.service';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import {
  ApiKeyEntity,
  CreateApiKeyResponseEntity,
} from './entities/api-key.entity';

@ApiTags('API Key Management')
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @ApiOperation({ summary: 'Create a new API Key for a user' })
  @ApiResponse({
    status: 201,
    type: CreateApiKeyResponseEntity,
    description: 'Returns the full API Key (shown only once)',
  })
  @Post()
  @Permission('IPCS.API_KEY_CREATE')
  async create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.apiKeyService.create(dto, user.username);
  }

  @ApiOperation({ summary: 'List all API Keys' })
  @ApiResponse({ status: 200, type: [ApiKeyEntity] })
  @Get()
  @Permission('IPCS.API_KEY_READ')
  async findAll(
    @Query('userId') userId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filter: { userId?: string; isActive?: boolean } = {};
    if (userId) filter.userId = userId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    return this.apiKeyService.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a single API Key by ID' })
  @ApiResponse({ status: 200, type: ApiKeyEntity })
  @Get(':id')
  @Permission('IPCS.API_KEY_READ')
  async findOne(@Param('id') id: string) {
    return this.apiKeyService.findOne(id);
  }

  @ApiOperation({ summary: 'Revoke an API Key' })
  @ApiResponse({ status: 200, type: ApiKeyEntity })
  @Patch(':id/revoke')
  @Permission('IPCS.API_KEY_UPDATE')
  async revoke(@Param('id') id: string) {
    return this.apiKeyService.revoke(id);
  }

  @ApiOperation({ summary: 'Reactivate a revoked API Key' })
  @ApiResponse({ status: 200, type: ApiKeyEntity })
  @Patch(':id/reactivate')
  @Permission('IPCS.API_KEY_UPDATE')
  async reactivate(@Param('id') id: string) {
    return this.apiKeyService.reactivate(id);
  }

  @ApiOperation({ summary: 'Delete an API Key permanently' })
  @ApiResponse({ status: 200, description: 'API Key deleted successfully' })
  @Delete(':id')
  @Permission('IPCS.API_KEY_DELETE')
  async delete(@Param('id') id: string) {
    return this.apiKeyService.delete(id);
  }
}
