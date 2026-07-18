import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  /**
   * bodyParser: false — required by @thallesp/nestjs-better-auth so Better Auth
   * can read the raw request body. The AuthModule re-adds parsers for other routes.
   */
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const frontendUrl = config.get<string>('frontendUrl', 'http://localhost:3000');
  const port = config.get<number>('port', 4000);
  const nodeEnv = config.get<string>('nodeEnv', 'development');

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  app.enableCors({
    origin: frontendUrl,
    credentials: true,
  });

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
  logger.log(`Auth endpoints: http://localhost:${port}/api/auth/*`);
  logger.log(`Uploads served at http://localhost:${port}/uploads/`);
}

bootstrap();
