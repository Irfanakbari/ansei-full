import { Injectable, Logger } from '@nestjs/common';
import { chmodSync, mkdirSync } from 'node:fs';
import { createLogger, format, Logger as WinstonLogger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface OriginalErrorLogContext {
  requestId?: string;
  method?: string;
  statusCode: number;
}

@Injectable()
export class OriginalErrorFileLogService {
  private readonly logger = new Logger(OriginalErrorFileLogService.name);
  private readonly auditLogger: WinstonLogger;
  private readonly storagePath =
    process.env.ERROR_LOG_STORAGE_PATH ?? '/app/storage/error-logs';

  constructor() {
    this.prepareStorage();
    const transport = new DailyRotateFile({
      dirname: this.storagePath,
      filename: 'secure-error-%DATE%.json',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles: process.env.ERROR_LOG_RETENTION ?? '14d',
      maxSize: process.env.ERROR_LOG_MAX_SIZE ?? '20m',
      options: { flags: 'a', mode: 0o600 },
    });
    transport.on('error', (error: Error) => {
      this.logger.error(`Secure error audit transport failed: ${error.name}`);
    });
    this.auditLogger = createLogger({
      level: 'error',
      format: format.combine(format.timestamp(), format.json()),
      transports: [transport],
    });
  }

  async write(
    exception: unknown,
    context: OriginalErrorLogContext,
  ): Promise<void> {
    const exceptionClass =
      exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const errorCode = this.getSafeErrorCode(exception);

    this.auditLogger.log('error', 'Unhandled server error', {
      event: 'ERROR_AUDIT',
      outcome: 'ERROR',
      requestId: this.sanitizeIdentifier(context.requestId),
      method: this.sanitizeMethod(context.method),
      statusCode: context.statusCode,
      exceptionClass: this.sanitizeIdentifier(exceptionClass),
      errorCode,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  private prepareStorage(): void {
    try {
      mkdirSync(this.storagePath, { recursive: true, mode: 0o700 });
      chmodSync(this.storagePath, 0o700);
    } catch (error: unknown) {
      const exceptionClass =
        error instanceof Error ? error.constructor.name : 'UnknownError';
      this.logger.error(
        `Unable to prepare secure error audit storage: ${exceptionClass}`,
      );
    }
  }

  private getSafeErrorCode(exception: unknown): string | undefined {
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof exception.code === 'string' &&
      /^[A-Z][A-Z0-9_]{1,31}$/.test(exception.code)
    ) {
      return exception.code;
    }

    return undefined;
  }

  private sanitizeIdentifier(value: string | undefined): string {
    if (value && /^[A-Za-z0-9_-]{1,128}$/.test(value)) {
      return value;
    }

    return 'unknown';
  }

  private sanitizeMethod(value: string | undefined): string {
    if (value && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(value)) {
      return value;
    }

    return 'UNKNOWN';
  }
}
