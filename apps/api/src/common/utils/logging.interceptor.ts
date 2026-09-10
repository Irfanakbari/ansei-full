import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = new Logger('HTTP_SUCCESS');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const { method, originalUrl } = req;

    const controllerName = context.getClass().name;
    const handlerName = context.getHandler().name;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        // Hanya log jika request berhasil (next.handle() sukses)
        next: () => {
          const res = ctx.getResponse();
          const { statusCode } = res;
          const duration = Date.now() - startTime;

          this.logger.log(
            `${method} ${originalUrl} ${statusCode} - ${duration}ms [${controllerName} -> ${handlerName}]`,
          );
        },
        // Jika error, abaikan saja karena akan di-handle oleh GlobalExceptionFilter
        error: () => {},
      }),
    );
  }
}
