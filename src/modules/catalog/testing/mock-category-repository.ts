import type { CategoryRepository } from '../domain/repositories/category.repository';

export function createMockCategoryRepository(): jest.Mocked<CategoryRepository> {
  return {
    findMany: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findProductsThatWouldBeOrphaned: jest.fn(),
  };
}
