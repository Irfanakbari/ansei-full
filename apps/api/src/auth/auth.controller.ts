import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import type { ICurrentUser } from './interfaces/current-user.interface';
import { UserEntity } from './entities/user.entity';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Get current SSO user profile' })
  @ApiResponse({ status: 200, type: UserEntity })
  @Get('profile')
  async getProfile(
    @CurrentUser() user: ICurrentUser,
  ): Promise<Omit<UserEntity, 'RoleName'> | null> {
    return this.authService.getUserWithPermissions(user.username);
  }
}
