import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { DualAuthGuard } from './guards/dual-auth.guard';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret =
          configService.get<string>('JWT_SECRET') ||
          'default-secret-key-change-in-production';
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '24h';
        return {
          secret,
          signOptions: { expiresIn: expiresIn as any },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    ApiKeyStrategy,
    JwtAuthGuard,
    PermissionsGuard,
    DualAuthGuard,
    MicrosoftStrategy,
  ],
  exports: [
    AuthService,
    JwtAuthGuard,
    PermissionsGuard,
    DualAuthGuard,
    ApiKeyStrategy,
  ],
})
export class AuthModule {}
