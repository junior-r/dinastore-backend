import type { ProductLookupPort } from '../domain/ports/product-lookup.port';

export function createMockProductLookup(): jest.Mocked<ProductLookupPort> {
  return {
    exists: jest.fn(),
  };
}
