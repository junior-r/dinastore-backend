import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FileStorage } from '@/shared/domain/storage/file-storage.port';
import {
  LocalDiskFileStorage,
  resolveLocalStorageDir,
} from './local-disk-file-storage';

describe('LocalDiskFileStorage', () => {
  let root: string;
  // Typed as the port — that is the only shape any consumer ever sees.
  let storage: FileStorage;
  const options = { contentType: 'image/webp' };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dinastore-storage-'));
    storage = new LocalDiskFileStorage(root, 'http://localhost:3000/uploads/');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('writes a file under its key, creating directories as needed', async () => {
    await storage.put('comments/a.webp', Buffer.from('hello'), options);

    expect(await readFile(join(root, 'comments', 'a.webp'), 'utf8')).toBe(
      'hello',
    );
  });

  it('deletes a stored file', async () => {
    await storage.put('comments/a.webp', Buffer.from('hello'), options);
    await storage.delete('comments/a.webp');

    await expect(stat(join(root, 'comments', 'a.webp'))).rejects.toThrow();
  });

  it('treats deleting a missing file as a no-op', async () => {
    await expect(
      storage.delete('comments/missing.webp'),
    ).resolves.toBeUndefined();
  });

  it('builds the public URL from the base URL and key', () => {
    expect(storage.publicUrl('comments/a.webp')).toBe(
      'http://localhost:3000/uploads/comments/a.webp',
    );
  });

  it.each(['../outside.webp', 'comments/../../outside.webp', ''])(
    'refuses a key that would escape the storage root (%p)',
    async (key) => {
      await expect(storage.put(key, Buffer.from('x'), options)).rejects.toThrow(
        'Invalid storage key',
      );
      await expect(storage.delete(key)).rejects.toThrow('Invalid storage key');
    },
  );
});

describe('resolveLocalStorageDir', () => {
  it('defaults to ./uploads under the working directory', () => {
    expect(resolveLocalStorageDir('')).toBe(join(process.cwd(), 'uploads'));
  });

  it('resolves a relative directory against the working directory', () => {
    expect(resolveLocalStorageDir('data/files')).toBe(
      join(process.cwd(), 'data', 'files'),
    );
  });

  it('keeps an absolute directory as is', () => {
    const absolute = join(tmpdir(), 'somewhere');
    expect(resolveLocalStorageDir(absolute)).toBe(absolute);
  });
});
