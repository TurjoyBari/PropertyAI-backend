import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

/**
 * Vercel serverless entry (no app.listen).
 * Built to dist/vercel.js and routed by vercel.json.
 */
let cachedServer: express.Express | undefined;

async function bootstrapServer(): Promise<express.Express> {
  if (cachedServer) return cachedServer;

  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, adapter, {
    bodyParser: false,
  });

  configureApp(app);
  await app.init();

  cachedServer = expressApp;
  return expressApp;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrapServer();
  return server(req, res);
}
