import { Module } from '@nestjs/common';
import { DashboardSettingModule } from './dashboard-setting/dashboard-setting.module';
import { EmailNotificationModule } from './email-notification/email-notification.module';
import { PrintAgentModule } from './print-agent/print-agent.module';
import { DisplayConfigModule } from './display-config/display-config.module';
import { AssemblyProcessSettingModule } from './assembly-process/assembly-process-setting.module';

@Module({
  imports: [
    DashboardSettingModule,
    EmailNotificationModule,
    PrintAgentModule,
    DisplayConfigModule,
    AssemblyProcessSettingModule,
  ],
  exports: [
    DashboardSettingModule,
    EmailNotificationModule,
    PrintAgentModule,
    DisplayConfigModule,
    AssemblyProcessSettingModule,
  ],
})
export class SettingsModule {}
