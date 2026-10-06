import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import type { Env } from './shared/infrastructure/config/env';
import { parseTrustProxy } from './shared/infrastructure/http/client-origin';
import {
  LOCAL_STORAGE_URL_PREFIX,
  resolveLocalStorageDir,
} from './shared/infrastructure/storage/local-disk-file-storage';

// Every static file has a random, never-reused name, so the bytes behind a
// URL can never change. That is what makes it safe to tell browsers to keep
// them for a year without revalidating.
const STATIC_ASSET_MAX_AGE = '365d';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Read through ConfigService, not process.env: these values have been
  // validated and had their defaults applied (see shared/.../config/env.ts).
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Decides what `request.ip` means, and so which address the product-view
  // history records. Off unless TRUST_PROXY is set: without a proxy in front,
  // honouring X-Forwarded-For would let any caller pick their own address.
  // Behind a load balancer or CDN it MUST be set, or every visitor is
  // recorded with the proxy's address instead of their own.
  const trustProxy = parseTrustProxy(
    config.get('TRUST_PROXY', { infer: true }),
  );
  if (trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
  }
  app.enableCors({ origin: config.get('FRONTEND_URL', { infer: true }) });
  // Serves the local-disk storage backend's directory (product and comment
  // images alike).
  app.useStaticAssets(
    resolveLocalStorageDir(config.get('STORAGE_LOCAL_DIR', { infer: true })),
    {
      prefix: `${LOCAL_STORAGE_URL_PREFIX}/`,
      maxAge: STATIC_ASSET_MAX_AGE,
      immutable: true,
    },
  );
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(Number(config.get('PORT', { infer: true })));
}
void bootstrap();
