import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
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
import { ThrottlerModule } from '@nestjs/throttler';
import { DualAuthGuard } from './auth/guards/dual-auth.guard';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Serve static assets (signatures, images, etc.)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'assets'),
      serveRoot: '/assets',
      exclude: ['/api*'],
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    JwtModule.register({
      global: true,
      secret: process.env.SECRET_KEY || 'tambun123',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 10,
        },
      ],
    }),
    AuthModule,
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global auth guard - applies to all routes by default
    {
      provide: APP_GUARD,
      useClass: DualAuthGuard,
    },
  ],
})
export class AppModule {}
