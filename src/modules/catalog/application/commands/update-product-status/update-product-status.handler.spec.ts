import { NotFoundException } from '@nestjs/common';
import {
  Product,
  ProductStatus,
} from '@/modules/catalog/domain/entities/product.entity';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { createMockProductRepository } from '@/modules/catalog/testing/mock-product-repository';
import { UpdateProductStatusCommand } from './update-product-status.command';
import { UpdateProductStatusHandler } from './update-product-status.handler';

describe('UpdateProductStatusHandler', () => {
  let repository: jest.Mocked<ProductRepository>;
  let handler: UpdateProductStatusHandler;

  beforeEach(() => {
    repository = createMockProductRepository();
    handler = new UpdateProductStatusHandler(repository);
  });

  it('changes the product status and persists it', async () => {
    const product = Product.create({
      name: 'Classic Tee',
      slug: 'classic-tee',
      description: null,
      basePriceCents: 2500,
      currency: 'USD',
      categoryIds: ['category-1'],
    });
    repository.findById.mockResolvedValue(product);
    repository.update.mockImplementation((p) => Promise.resolve(p));

    const result = await handler.execute(
      new UpdateProductStatusCommand(product.id, ProductStatus.PUBLISHED),
    );

    expect(result.status).toBe(ProductStatus.PUBLISHED);
  });

  it('throws NotFoundException when the product does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new UpdateProductStatusCommand('missing', ProductStatus.ARCHIVED),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
