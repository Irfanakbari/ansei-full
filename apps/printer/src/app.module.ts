import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { PrinterProcessor } from "./printer.processor";
import { PartTagPdfService } from "./part-tag-pdf.service";
import { IpPrinterService } from "./ip-printer.service";
import { PrinterSettingService } from "./printer-setting.service";
import { PrinterErrorFileLogService } from "./printer-error-file-log.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>("REDIS_HOST", "localhost"),
          port: Number(configService.get<number>("REDIS_PORT", 6379)),
          password: configService.get<string>("REDIS_PASSWORD") || undefined,
          maxRetriesPerRequest: null,
          retryStrategy(times: number) {
            return Math.min(times * 1000, 15000);
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: "printer_queue",
    }),
  ],
  providers: [
    PrinterProcessor,
    PartTagPdfService,
    IpPrinterService,
    PrinterSettingService,
    PrinterErrorFileLogService,
  ],
})
export class AppModule {}
