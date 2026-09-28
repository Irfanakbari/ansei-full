import { Module } from '@nestjs/common';
import { DashboardSettingModule } from './dashboard-setting/dashboard-setting.module';
import { EmailNotificationModule } from './email-notification/email-notification.module';
import { PrintAgentModule } from './print-agent/print-agent.module';
import { DisplayConfigModule } from './display-config/display-config.module';

@Module({
  imports: [
    DashboardSettingModule,
    EmailNotificationModule,
    PrintAgentModule,
    DisplayConfigModule,
  ],
  exports: [
    DashboardSettingModule,
    EmailNotificationModule,
    PrintAgentModule,
    DisplayConfigModule,
  ],
})
export class SettingsModule {}
