import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VuteqSsoModule } from '@vuteq/sso-client-nest';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ApiKeyStrategy } from './strategies/api-key.strategy';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { DualAuthGuard } from './guards/dual-auth.guard';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    VuteqSsoModule.forRootAsync({
      imports: [PrismaModule],
      inject: [ConfigService, PrismaService],
      useFactory: (configService: ConfigService, prisma: PrismaService) => ({
         baseUrl: configService.getOrThrow<string>('VUTEQ_SSO_BASE_URL'),
         secret: configService.getOrThrow<string>('VUTEQ_SSO_SECRET'),
         global: false,
        resolveAuthorization: async (identity) => {
          const email = identity.email ?? `${identity.id}@sso.invalid`;
          const name = identity.name ?? identity.username ?? identity.id;
          const existingBySsoId = await prisma.mTCUserManagement.findUnique({
            where: { SsoObjectId: identity.id },
          });
          const existingByEmail = existingBySsoId
            ? null
            : await prisma.mTCUserManagement.findUnique({ where: { Email: email } });

          const user = existingBySsoId || existingByEmail
            ? await prisma.mTCUserManagement.update({
                where: { Id: (existingBySsoId || existingByEmail)!.Id },
                data: {
                  UserId: identity.id,
                  SsoObjectId: identity.id,
                  Name: name,
                  Email: email,
                  LastLogin: new Date(),
                },
                include: { Role: { include: { Permission: true } } },
              })
            : await prisma.mTCUserManagement.create({
                data: {
                  UserId: identity.id,
                  SsoObjectId: identity.id,
                  Name: name,
                  Email: email,
                  LastLogin: new Date(),
                },
                include: { Role: { include: { Permission: true } } },
              });
          if (!user.IsActive) throw new Error('User account is inactive');
          return {
            roles: user.Role ? [user.Role.RoleName] : [],
            permissions:
              user.Role?.Permission.map((permission) => permission.Action) ??
              [],
            attributes: { roleId: user.RoleId },
          };
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ApiKeyStrategy, PermissionsGuard, DualAuthGuard],
  exports: [AuthService, PermissionsGuard, DualAuthGuard, ApiKeyStrategy],
})
export class AuthModule {}
