import type { FileStorage } from '../domain/storage/file-storage.port';

export function createMockFileStorage(): jest.Mocked<FileStorage> {
  return {
    put: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    publicUrl: jest.fn((key: string) => `https://files.test/${key}`),
  };
}
