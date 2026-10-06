import type { UserRepository } from '../domain/repositories/user.repository';

export function createMockUserRepository(): jest.Mocked<UserRepository> {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    emailExists: jest.fn(),
    create: jest.fn(),
    findByProviderAccount: jest.fn(),
    linkOAuthAccount: jest.fn(),
    setAvatarUrlIfMissing: jest.fn(),
    createFromOAuth: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    findDetailById: jest.fn(),
  };
}
