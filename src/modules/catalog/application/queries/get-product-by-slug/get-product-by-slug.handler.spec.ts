import { NotFoundException } from '@nestjs/common';
import {
  Product,
  ProductStatus,
} from '@/modules/catalog/domain/entities/product.entity';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { createMockProductRepository } from '@/modules/catalog/testing/mock-product-repository';
import { GetProductBySlugHandler } from './get-product-by-slug.handler';
import { GetProductBySlugQuery } from './get-product-by-slug.query';

describe('GetProductBySlugHandler', () => {
  let repository: jest.Mocked<ProductRepository>;
  let handler: GetProductBySlugHandler;

  beforeEach(() => {
    repository = createMockProductRepository();
    handler = new GetProductBySlugHandler(repository);
  });

  it('returns the product when found', async () => {
    const product = Product.fromPersistence({
      id: 'product-1',
      name: 'Classic Tee',
      slug: 'classic-tee',
      description: null,
      basePriceCents: 2500,
      currency: 'USD',
      status: ProductStatus.PUBLISHED,
      categoryIds: ['category-1'],
      variants: [],
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    repository.findBySlug.mockResolvedValue(product);

    const result = await handler.execute(
      new GetProductBySlugQuery('classic-tee'),
    );

    expect(repository.findBySlug).toHaveBeenCalledWith('classic-tee');
    expect(result).toBe(product);
  });

  it('throws NotFoundException when no product matches the slug', async () => {
    repository.findBySlug.mockResolvedValue(null);

    await expect(
      handler.execute(new GetProductBySlugQuery('missing')),
    ).rejects.toThrow(NotFoundException);
  });
});
