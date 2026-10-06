import type { CountryResolverPort } from '../domain/ports/country-resolver.port';
import type { ViewedProductPort } from '../domain/ports/viewed-product.port';

export function createMockViewedProductPort(): jest.Mocked<ViewedProductPort> {
  return { findName: jest.fn() };
}

export function createMockCountryResolver(): jest.Mocked<CountryResolverPort> {
  return { resolve: jest.fn() };
}
