import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PermissionsGuard } from './guards/permissions.guard';
import { DualAuthGuard } from './guards/dual-auth.guard';
import { SsoAuthService } from './sso-auth.service';

@Module({
  imports: [PrismaModule, PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    ApiKeyStrategy,
    PermissionsGuard,
    SsoAuthService,
    DualAuthGuard,
  ],
  exports: [
    AuthService,
    PermissionsGuard,
    SsoAuthService,
    DualAuthGuard,
    ApiKeyStrategy,
  ],
})
export class AuthModule {}
