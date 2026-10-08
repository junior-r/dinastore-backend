export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface PutFileOptions {
  contentType: string;
  /**
   * Passed through to backends that store it per object (S3, GCS, R2...).
   * The local-disk adapter ignores it — there the header is set by the static
   * file middleware in main.ts instead.
   */
  cacheControl?: string;
}

/**
 * Where uploaded files live. Callers only ever hold a **key** (e.g.
 * `comments/<uuid>.webp`) — never a path or a URL — and that key is what gets
 * persisted. URLs are derived at read time via `publicUrl()`, so moving to
 * another backend or putting a CDN in front is a config change plus copying
 * the objects across, not a data migration over every stored URL.
 */
export interface FileStorage {
  put(key: string, data: Buffer, options: PutFileOptions): Promise<void>;
  /** Idempotent: deleting a key that is already gone is not an error. */
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

/**
 * Keys are never overwritten (every upload gets a fresh random one), so
 * anything stored can be cached forever by browsers and CDNs.
 */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
