import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

@Injectable()
export class PrinterSettingService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;
  private readonly logger = new Logger(PrinterSettingService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const connectionString =
      this.configService.get<string>("DATABASE_URL") ||
      process.env.DATABASE_URL;

    if (connectionString) {
      try {
        this.pool = new Pool({ connectionString });
        this.logger.log("Database pool initialized for PrinterSetting lookup.");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        this.logger.error(
          `Failed to initialize database pool for PrinterSetting: ${message}`,
        );
      }
    } else {
      this.logger.warn(
        "DATABASE_URL not configured. Will use default fallback IP for printing.",
      );
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async getActivePrinterIp(): Promise<string | null> {
    if (!this.pool) {
      return null;
    }
    try {
      const res = await this.pool.query(
        'SELECT "IpAddress", "Name" FROM "PrinterSetting" ORDER BY "CreatedAt" DESC LIMIT 1',
      );
      if (res.rows.length > 0 && res.rows[0].IpAddress) {
        this.logger.log(
          `Resolved printer from PrinterSetting: ${res.rows[0].Name ?? "Unnamed"} (${res.rows[0].IpAddress})`,
        );
        return res.rows[0].IpAddress;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Failed to query PrinterSetting from database: ${message}`,
      );
    }
    return null;
  }
}
