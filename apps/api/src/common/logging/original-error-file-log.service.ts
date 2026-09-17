import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { chmodSync, mkdirSync } from 'node:fs';
import { createLogger, format, Logger as WinstonLogger } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

export interface OriginalErrorLogContext {
  requestId?: string;
  method?: string;
  path?: string;
  statusCode: number;
}

@Injectable()
export class OriginalErrorFileLogService implements OnApplicationShutdown {
  private readonly logger = new Logger(OriginalErrorFileLogService.name);
  private readonly auditLogger: WinstonLogger;
  private readonly storagePath =
    process.env.ERROR_LOG_STORAGE_PATH ?? '/app/storage/error-logs';

  constructor() {
    this.prepareStorage();
    const transport = new DailyRotateFile({
      dirname: this.storagePath,
      filename: 'secure-error-%DATE%.txt',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxFiles:
        process.env.ERROR_LOG_RETENTION ??
        process.env.ERROR_LOGS_RETENTION ??
        '14d',
      maxSize:
        process.env.ERROR_LOG_MAX_SIZE ??
        process.env.ERROR_LOGS_MAX_SIZE ??
        '20m',
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

  onApplicationShutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.auditLogger.once('finish', resolve);
      this.auditLogger.end();
    });
  }

  async write(
    exception: unknown,
    context: OriginalErrorLogContext,
  ): Promise<void> {
    const exceptionClass =
      exception instanceof Error ? exception.constructor.name : 'UnknownError';
    const errorCode = this.getSafeErrorCode(exception);
    const safeMessage = this.getSafeMessage(exception);

    this.auditLogger.log('error', 'Unhandled server error', {
      event: 'ERROR_AUDIT',
      outcome: 'ERROR',
      requestId: this.sanitizeIdentifier(context.requestId),
      method: this.sanitizeMethod(context.method),
      path: this.sanitizePath(context.path),
      statusCode: context.statusCode,
      exceptionClass: this.sanitizeIdentifier(exceptionClass),
      errorCode,
      safeMessage,
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

  private getSafeMessage(exception: unknown): string {
    if (!(exception instanceof Error)) {
      return 'Unknown server error';
    }

    return exception.message
      .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://[REDACTED]@')
      .replace(
        /(password|token|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,
        '$1=[REDACTED]',
      )
      .replace(/\b\d{7,}\b/g, '[REDACTED]')
      .replace(/[\r\n\t]+/g, ' ')
      .slice(0, 1000);
  }

  private sanitizePath(value: string | undefined): string {
    if (!value) return 'unknown';

    const path = value.split('?')[0];
    return /^\/[A-Za-z0-9_./:-]{1,512}$/.test(path) ? path : 'unknown';
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
