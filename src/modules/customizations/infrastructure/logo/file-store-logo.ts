import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import {
  FILE_STORAGE,
  IMMUTABLE_CACHE_CONTROL,
} from '@/shared/domain/storage/file-storage.port';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import type { Env } from '@/shared/infrastructure/config/env';
import type {
  StoreLogo,
  StoreLogoPort,
} from '@/modules/customizations/domain/ports/store-logo.port';

const LOGO_KEY_PREFIX = 'brand';

/**
 * Reads the logo from a file on this machine (STORE_LOGO_PATH) and publishes
 * a copy to file storage so the studio can load it.
 *
 * The published key contains a hash of the file's contents. Stored files are
 * cached forever by browsers, so replacing the logo has to produce a new URL
 * or returning shoppers would keep previewing the old one.
 */
@Injectable()
export class FileStoreLogo implements StoreLogoPort {
  private loaded: Promise<StoreLogo> | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(FILE_STORAGE) private readonly fileStorage: FileStorage,
  ) {}

  get(): Promise<StoreLogo> {
    // Read once per process. A failed attempt is not kept, so fixing the
    // file doesn't need a restart to be noticed.
    this.loaded ??= this.load().catch((error: unknown) => {
      this.loaded = null;
      throw error;
    });
    return this.loaded;
  }

  private async load(): Promise<StoreLogo> {
    const configured = this.config.get('STORE_LOGO_PATH', { infer: true });
    const path = isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);

    const data = await readFile(path);
    const { width, height, format } = await sharp(data).metadata();

    const hash = createHash('sha256').update(data).digest('hex').slice(0, 12);
    const key = `${LOGO_KEY_PREFIX}/store-logo-${hash}.${format}`;
    await this.fileStorage.put(key, data, {
      contentType: `image/${format}`,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    });

    return { data, width, height, url: this.fileStorage.publicUrl(key) };
  }
}
