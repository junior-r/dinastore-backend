import type { DesignRenderer } from '../domain/ports/design-renderer.port';
import type { StoreLogoPort } from '../domain/ports/store-logo.port';
import type { DesignRepository } from '../domain/repositories/design.repository';

export function createMockDesignRepository(): jest.Mocked<DesignRepository> {
  return { create: jest.fn() };
}

export function createMockDesignRenderer(): jest.Mocked<DesignRenderer> {
  return { render: jest.fn() };
}

export function createMockStoreLogo(): jest.Mocked<StoreLogoPort> {
  return { get: jest.fn() };
}
