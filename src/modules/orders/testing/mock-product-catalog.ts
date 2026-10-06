import type { DesignLookupPort } from '../domain/repositories/design-lookup.port';
import type { ProductCatalogPort } from '../domain/repositories/product-catalog.port';

export function createMockDesignLookup(): jest.Mocked<DesignLookupPort> {
  return {
    findByIds: jest.fn().mockResolvedValue([]),
  };
}

export function createMockProductCatalog(): jest.Mocked<ProductCatalogPort> {
  return {
    findVariantsByIds: jest.fn(),
  };
}
