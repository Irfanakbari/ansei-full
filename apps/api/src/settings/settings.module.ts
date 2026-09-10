import { Module } from '@nestjs/common';
import { DashboardSettingModule } from './dashboard-setting/dashboard-setting.module';
import { EmailNotificationModule } from './email-notification/email-notification.module';
import { PrinterSettingModule } from './printer-setting/printer-setting.module';
import { DisplayConfigModule } from './display-config/display-config.module';

@Module({
  imports: [
    DashboardSettingModule,
    EmailNotificationModule,
    PrinterSettingModule,
    DisplayConfigModule,
  ],
  exports: [
    DashboardSettingModule,
    EmailNotificationModule,
    PrinterSettingModule,
    DisplayConfigModule,
  ],
})
export class SettingsModule {}
