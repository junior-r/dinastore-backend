import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import { ENV_DEFAULTS } from '@/shared/infrastructure/config/env';

/** URL prefix main.ts serves the local storage directory under. */
export const LOCAL_STORAGE_URL_PREFIX = '/uploads';

/**
 * Shared by the adapter and by main.ts's static-file middleware so the
 * directory written to and the directory served can never drift apart.
 */
export function resolveLocalStorageDir(
  configured: string | undefined = process.env.STORAGE_LOCAL_DIR,
): string {
  const dir = configured?.trim() || ENV_DEFAULTS.STORAGE_LOCAL_DIR;
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
}

/**
 * Development/single-server backend: files on this machine's disk, served by
 * the API itself. Not suitable once the API runs on more than one instance or
 * on an ephemeral filesystem — that is what the FileStorage port is for.
 */
export class LocalDiskFileStorage implements FileStorage {
  private readonly rootDir: string;
  private readonly publicBaseUrl: string;

  constructor(rootDir: string, publicBaseUrl: string) {
    this.rootDir = resolve(rootDir);
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, '');
  }

  // PutFileOptions is deliberately not read here: Cache-Control and
  // Content-Type are applied by the static middleware that serves this
  // directory (see main.ts), not stored per file.
  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  publicUrl(key: string): string {
    const path = key.split('/').map(encodeURIComponent).join('/');
    return `${this.publicBaseUrl}/${path}`;
  }

  // Keys are generated server-side today, but this is the one place a key
  // becomes a filesystem path, so it refuses anything that would escape the
  // root rather than trusting every future caller to get that right.
  private pathFor(key: string): string {
    const path = resolve(this.rootDir, key);
    if (!key || !path.startsWith(this.rootDir + sep)) {
      throw new Error(`Invalid storage key "${key}"`);
    }
    return path;
  }
}
