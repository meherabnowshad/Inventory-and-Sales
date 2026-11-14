import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Set global API prefix: /api
  app.setGlobalPrefix('api');

  // Validate every request body against its DTO (IMS-08.1, NFR-SEC-02)
  // whitelist: drop fields not in the DTO; transform: apply @Transform (trim) and build DTO instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS Configuration
  const allowedOrigins = process.env.CORS_ORIGIN || 'http://localhost:5173';
  app.enableCors({
    origin: allowedOrigins.includes(',')
      ? allowedOrigins.split(',').map((o) => o.trim())
      : allowedOrigins,
    credentials: true,
  });

  const port = process.env.PORT || 5001;
  await app.listen(port);
  logger.log(`NestJS 10 Backend running on http://localhost:${port}/api`);
  logger.log(`Health check: http://localhost:${port}/api/health`);
}

bootstrap();
