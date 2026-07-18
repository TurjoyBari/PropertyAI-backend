import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const frontendUrl = config.get<string>('frontendUrl', 'http://localhost:3000');
  const port = config.get<number>('port', 4000);
  const nodeEnv = config.get<string>('nodeEnv', 'development');

  // Allow the Next.js frontend to call this API (cookies later need credentials).
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

  /**
   * Global validation:
   * - whitelist: strip unknown properties
   * - forbidNonWhitelisted: reject unknown properties with 400
   * - transform: auto-convert payloads to DTO class instances
   */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(port);

  logger.log(`PropertyAI API running on http://localhost:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`CORS origin: ${frontendUrl}`);
}

bootstrap();
