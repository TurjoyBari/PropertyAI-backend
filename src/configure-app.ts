import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

/**
 * Shared Nest wiring for local `main.ts` and Vercel serverless `vercel.ts`.
 */
export function configureApp(app: NestExpressApplication) {
  const config = app.get(ConfigService);
  const frontendUrl = config.get<string>('frontendUrl', 'http://localhost:3000');
  const port = config.get<number>('port', 4000);
  const nodeEnv = config.get<string>('nodeEnv', 'development');

  // Ephemeral on Vercel — uploads won't persist across deploys; OK for demo.
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  app.enableCors({
    origin: true,
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

  return { config, frontendUrl, port, nodeEnv };
}
