import type { ProductRepository } from '../domain/repositories/product.repository';

export function createMockProductRepository(): jest.Mocked<ProductRepository> {
  return {
    findMany: jest.fn(),
    count: jest.fn(),
    findById: jest.fn(),
    findBySlug: jest.fn(),
    slugExists: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateVariants: jest.fn(),
    updateImages: jest.fn(),
    delete: jest.fn(),
  };
}
