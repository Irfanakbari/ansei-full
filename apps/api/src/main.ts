import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // logger: ['error', 'warn', 'debug', 'log', 'verbose'],
  });
  //
  // app.useGlobalFilters(new GlobalExceptionFilter());
  // app.useGlobalInterceptors(new LoggingInterceptor());

  app.use(
    helmet({
      hsts: false,
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  const instance = app.getHttpAdapter().getInstance();
  if (instance && instance.set) {
    instance.set('trust proxy', 1);
  }

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const production = configService.get<string>('NODE_ENV') === 'production';
  const swaggerEnabled =
    configService.get<string>('SWAGGER_ENABLED') === 'true' ||
    (!production && configService.get<string>('SWAGGER_ENABLED') !== 'false');
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('ANSEI REVAMP API')
      .setDescription(
        'Dokumentasi API untuk sistem ANSEI REVAMP. Menangani modul Autentikasi, ' +
          'User Management, Master Data (Material, Satuan, Supplier, Finish Good, BOM, Box Qty, Man Power), ' +
          'Production (Forecast, Shopping, Production Release, Production Report, Pre-Delivery, Pokayoke), ' +
          'Warehouse (Incoming, Transfer), Inventory Counting, System Logs, dan Settings.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    const apiKey = configService.get<string>('SWAGGER_API_KEY');
    const protect = (req: Request, res: Response, next: NextFunction) => {
      if (!apiKey || req.headers['x-docs-api-key'] === apiKey) return next();
      res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Documentation authentication failed',
      });
    };
    const instance = app.getHttpAdapter().getInstance();
    instance.use('/api/docs', protect);
    instance.use('/api/docs-json', protect);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
    });
  }

  const port = configService.get<number>('PORT', 7500);
  await app.listen(port);
  Logger.log(`Application is running on port ${port}`, 'Bootstrap');
}
bootstrap().catch((err) => {
  Logger.error(
    err instanceof Error ? err.message : 'Failed to start application',
    undefined,
    'Bootstrap',
  );
  process.exit(1);
});
