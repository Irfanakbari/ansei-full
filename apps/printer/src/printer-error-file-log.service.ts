import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { chmodSync, mkdirSync } from "node:fs";
import { createLogger, format, Logger as WinstonLogger } from "winston";
import type { transport as WinstonTransport } from "winston";
// winston-daily-rotate-file is CommonJS and exports the transport constructor directly.
const DailyRotateFile = require("winston-daily-rotate-file") as new (options: {
  dirname: string;
  filename: string;
  datePattern: string;
  zippedArchive: boolean;
  maxFiles: string;
  maxSize: string;
  options: { flags: string };
}) => WinstonTransport;

export interface PrinterErrorLogContext {
  jobId?: string;
  jobName?: string;
  poId?: string;
  poNumber?: string;
  partNumber?: string;
  partName?: string;
  printerIp?: string;
  port?: number;
  protocol?: string;
  attemptsMade?: number;
  maxAttempts?: number;
  durationMs?: number;
  [key: string]: unknown;
}

@Injectable()
export class PrinterErrorFileLogService implements OnModuleInit {
  private readonly logger = new Logger(PrinterErrorFileLogService.name);
  private winstonLogger: WinstonLogger | null = null;
  private readonly storagePath =
    process.env.ERROR_LOG_STORAGE_PATH ??
    (process.platform === "win32"
      ? "./storage/error-logs"
      : "/app/storage/error-logs");

  onModuleInit() {
    this.prepareStorage();
    try {
      const transport = new DailyRotateFile({
        dirname: this.storagePath,
        filename: "printer-error-%DATE%.json",
        datePattern: "YYYY-MM-DD",
        zippedArchive: true,
        maxFiles: process.env.ERROR_LOG_RETENTION ?? "14d",
        maxSize: process.env.ERROR_LOG_MAX_SIZE ?? "20m",
        options: { flags: "a" },
      });

      transport.on("error", (error: Error) => {
        this.logger.error(
          `Printer error audit transport failed: ${error.message}`,
        );
      });

      this.winstonLogger = createLogger({
        level: "error",
        format: format.combine(format.timestamp(), format.json()),
        transports: [transport],
      });
      this.logger.log(
        `Winston error logger initialized at ${this.storagePath}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to initialize Winston daily rotate log: ${msg}`,
      );
    }
  }

  async write(
    error: unknown,
    context: PrinterErrorLogContext = {},
  ): Promise<void> {
    if (!this.winstonLogger) {
      this.onModuleInit();
    }

    if (!this.winstonLogger) {
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorCode =
      error && typeof error === "object" && "code" in error
        ? String((error as any).code)
        : undefined;

    this.winstonLogger.log("error", errorMessage, {
      event: "PRINTER_ERROR",
      outcome: "FAILED",
      timestamp: new Date().toISOString(),
      errorCode,
      context,
      stack: errorStack,
    });

    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  private prepareStorage(): void {
    try {
      mkdirSync(this.storagePath, { recursive: true });
      if (process.platform !== "win32") {
        chmodSync(this.storagePath, 0o700);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Unable to prepare printer error log storage: ${message}`,
      );
    }
  }
}
