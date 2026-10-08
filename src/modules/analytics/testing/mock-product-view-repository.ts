import type { ProductViewRepository } from '../domain/repositories/product-view.repository';

export function createMockProductViewRepository(): jest.Mocked<ProductViewRepository> {
  return {
    findById: jest.fn(),
    save: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  };
}
