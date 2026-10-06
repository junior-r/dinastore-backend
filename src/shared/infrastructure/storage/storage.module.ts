import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FILE_STORAGE } from '@/shared/domain/storage/file-storage.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { ENV_DEFAULTS } from '@/shared/infrastructure/config/env';
import {
  LOCAL_STORAGE_URL_PREFIX,
  LocalDiskFileStorage,
  resolveLocalStorageDir,
} from './local-disk-file-storage';

/**
 * The single place a storage backend is chosen. To add one (S3, R2, GCS...):
 * write a class implementing FileStorage next to LocalDiskFileStorage, add a
 * `case` here, and set STORAGE_DRIVER. Nothing outside this folder changes —
 * every consumer injects FILE_STORAGE and persists keys, not URLs.
 */
@Global()
@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      useFactory: (config: ConfigService): FileStorage => {
        const driver =
          config.get<string>('STORAGE_DRIVER')?.trim() ||
          ENV_DEFAULTS.STORAGE_DRIVER;

        switch (driver) {
          case 'local': {
            const appUrl = (
              config.get<string>('APP_URL') ?? ENV_DEFAULTS.APP_URL
            ).replace(/\/+$/, '');
            return new LocalDiskFileStorage(
              resolveLocalStorageDir(config.get<string>('STORAGE_LOCAL_DIR')),
              // STORAGE_PUBLIC_URL lets a CDN/reverse proxy front the files
              // without touching anything stored.
              config.get<string>('STORAGE_PUBLIC_URL')?.trim() ||
                `${appUrl}${LOCAL_STORAGE_URL_PREFIX}`,
            );
          }
          default:
            // Fail at boot rather than silently writing to local disk on a
            // deployment that was configured for something else.
            throw new Error(`Unknown STORAGE_DRIVER "${driver}"`);
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
