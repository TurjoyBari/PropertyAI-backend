import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the Next.js frontend (port 3000) to call this API during development.
  // More precise CORS rules will be added with authentication later.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);

  console.log(`PropertyAI API running on http://localhost:${port}`);
}

bootstrap();
