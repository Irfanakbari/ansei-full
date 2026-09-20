import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { EmailNotificationService } from './email-notification.service';
import { CreateEmailNotificationDto, UpdateEmailNotificationDto } from './dto';
import { Permission } from '../../auth/decorators/permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { ICurrentUser } from '../../auth/interfaces/current-user.interface';
import { SearchPaginationQueryDto } from '../../common/dto/search-pagination-query.dto';

@ApiTags('EmailNotification')
@Controller('settings/email-notification')
export class EmailNotificationController {
  constructor(
    private readonly emailNotificationService: EmailNotificationService,
  ) {}

  @Get()
  @Permission('IPCS.MASTER_READ')
  async findAll(
    @Query() query: SearchPaginationQueryDto,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.emailNotificationService.findAll(query);
  }

  @Get(':id')
  @Permission('IPCS.MASTER_READ')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.emailNotificationService.findOne(id);
  }

  @Get('email/:email')
  @Permission('IPCS.MASTER_READ')
  async findByEmail(
    @Param('email') email: string,
    @CurrentUser() _user: ICurrentUser,
  ) {
    return this.emailNotificationService.findByEmail(email);
  }

  @Post()
  @Permission('IPCS.MASTER_CREATE')
  async create(
    @Body() createEmailNotificationDto: CreateEmailNotificationDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.emailNotificationService.create(
      createEmailNotificationDto,
      user.username,
    );
  }

  @Patch(':id')
  @Permission('IPCS.MASTER_UPDATE')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmailNotificationDto: UpdateEmailNotificationDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.emailNotificationService.update(
      id,
      updateEmailNotificationDto,
      user.username,
    );
  }

  @Delete(':id')
  @Permission('IPCS.MASTER_DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    return this.emailNotificationService.remove(id, user.username);
  }
}
