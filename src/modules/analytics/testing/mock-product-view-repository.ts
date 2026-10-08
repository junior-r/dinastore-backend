import type { ProductViewRepository } from '../domain/repositories/product-view.repository';

export function createMockProductViewRepository(): jest.Mocked<ProductViewRepository> {
  return {
    findById: jest.fn(),
    save: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    totals: jest.fn(),
    daily: jest.fn(),
    byCountry: jest.fn(),
    groupByProduct: jest.fn(),
    countProducts: jest.fn(),
    groupByVisitor: jest.fn(),
    countVisitors: jest.fn(),
    productWindows: jest.fn(),
  };
}
