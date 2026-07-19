import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  /**
   * bodyParser: false — required by @thallesp/nestjs-better-auth so Better Auth
   * can read the raw request body. The AuthModule re-adds parsers for other routes.
   */
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const logger = new Logger('Bootstrap');
  const { frontendUrl, port, nodeEnv } = configureApp(app);

  await app.listen(port);

  logger.log(`PropertyAI API running on http://localhost:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`CORS origin: ${frontendUrl}`);
  logger.log(`Auth endpoints: http://localhost:${port}/api/auth/*`);
  logger.log(`Uploads served at http://localhost:${port}/uploads/`);
}

void bootstrap();
