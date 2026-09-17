import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './auth/auth.module';
import { UserManagementModule } from './user-management/user-management.module';
import { SatuanModule } from './master/satuan/satuan.module';
import { SupplierModule } from './master/supplier/supplier.module';
import { MaterialModule } from './master/material/material.module';
import { FinishGoodModule } from './master/finish-good/finish-good.module';
import { BillOfMaterialsModule } from './master/bill-of-materials/bill-of-materials.module';
import { BoxQtyModule } from './master/box-qty/box-qty.module';
import { ManPowerModule } from './master/man-power/man-power.module';
import { SettingsModule } from './settings/settings.module';
import { ForecastModule } from './production/forecast/forecast.module';
import { ProductionReleaseModule } from './production/production-release/production-release.module';
import { ProductionReportModule } from './production/production-report/production-report.module';
import { PreDeliveryModule } from './production/pre-delivery/pre-delivery.module';
import { PokayokeModule } from './production/pokayoke/pokayoke.module';
import { DeliveryModule } from './production/delivery/delivery.module';
import { IncomingModule } from './warehouse/incoming/incoming.module';
import { ShoppingModule } from './production/shopping/shopping.module';
import { TransferModule } from './warehouse/transfer/transfer.module';
import { SystemLogModule } from './system-log/system-log.module';
import { InventoryCountingModule } from './inventory-counting/inventory-counting.module';
import { MaterialDeliveryNoteModule } from './material-delivery-note/material-delivery-note.module';
import { FrontendModule } from './frontend/frontend.module';
import { MrpModule } from './mrp/mrp.module';
import { ReportModule } from './report/report.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DualAuthGuard } from './auth/guards/dual-auth.guard';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { LoggingModule } from './common/logging/logging.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import { RequestCorrelationMiddleware } from './common/middleware/request-correlation.middleware';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { OutboxModule } from './common/outbox/outbox.module';
import { validateEnvironment } from './config/environment.validation';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    // Serve static assets (signatures, images, etc.)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'assets'),
      serveRoot: '/assets',
      exclude: ['/api*'],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<number>('REDIS_PORT', 6379)),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          maxRetriesPerRequest: null,
          retryStrategy(times: number) {
            return Math.min(times * 1000, 15000);
          },
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    PrismaModule,
    OutboxModule,
    AuthModule,
    LoggingModule,
    UserManagementModule,
    SatuanModule,
    SupplierModule,
    MaterialModule,
    FinishGoodModule,
    BillOfMaterialsModule,
    BoxQtyModule,
    ManPowerModule,
    SettingsModule,
    ForecastModule,
    ProductionReleaseModule,
    ProductionReportModule,
    PreDeliveryModule,
    PokayokeModule,
    DeliveryModule,
    IncomingModule,
    ShoppingModule,
    TransferModule,
    SystemLogModule,
    InventoryCountingModule,
    MaterialDeliveryNoteModule,
    FrontendModule,
    MrpModule,
    ReportModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global auth guard - applies to all routes by default
    {
      provide: APP_GUARD,
      useClass: DualAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: PrismaClientExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestCorrelationMiddleware).forRoutes('*');
  }
}
