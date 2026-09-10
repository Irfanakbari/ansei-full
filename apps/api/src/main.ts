import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaClientExceptionFilter } from './common/filters/prisma-client-exception.filter';
import helmet from 'helmet';

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
  const { httpAdapter } = app.get(HttpAdapterHost);

  const instance = app.getHttpAdapter().getInstance();
  if (instance && instance.set) {
    instance.set('trust proxy', 1);
  }

  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new PrismaClientExceptionFilter(httpAdapter),
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.enableShutdownHooks();

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
  SwaggerModule.setup('api/docs', app, document);
  app.getHttpAdapter().get('/docs-json', (req, res) => {
    res.json(document);
  });

  app.listen(process.env.PORT ?? 7500).then(
    () => {
      console.log(
        `🚀 Application is running on port ${process.env.PORT ?? 7500}`,
      );
    },
    (err) => {
      console.error('Failed to start server:', err);
    },
  );
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
