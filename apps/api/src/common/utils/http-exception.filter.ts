import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  ExecutionContext,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private logger = new Logger('HTTP_ERROR');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Tentukan HTTP Status
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Tentukan Pesan Error
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as Error).message;

    // Type casting yang aman ke ExecutionContext
    const exeContext = host as unknown as ExecutionContext;

    // Ambil nama controller & handler, jika salah URL/404 akan otomatis jadi 'RouteNotFound'
    const controllerName =
      typeof exeContext.getClass === 'function' && exeContext.getClass()
        ? exeContext.getClass().name
        : 'RouteNotFound';

    const handlerName =
      typeof exeContext.getHandler === 'function' && exeContext.getHandler()
        ? exeContext.getHandler().name
        : 'None';

    // Cetak Log Error ke Terminal
    this.logger.error(
      `${request.method} ${request.originalUrl} ${status} [${controllerName} -> ${handlerName}] - Error: ${JSON.stringify(message)}`,
    );

    // Kirim response standar ke client
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        exception instanceof HttpException
          ? (message as any).message || message
          : 'Internal server error',
    });
  }
}
