import { NotFoundException } from '@nestjs/common';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { createMockProductRepository } from '@/modules/catalog/testing/mock-product-repository';
import { UpdateProductCommand } from './update-product.command';
import { UpdateProductHandler } from './update-product.handler';

describe('UpdateProductHandler', () => {
  let repository: jest.Mocked<ProductRepository>;
  let handler: UpdateProductHandler;

  beforeEach(() => {
    repository = createMockProductRepository();
    handler = new UpdateProductHandler(repository);
  });

  it('updates the product and persists it', async () => {
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
      new UpdateProductCommand(
        product.id,
        'Deluxe Tee',
        'A nicer shirt',
        3000,
        'USD',
        ['category-2'],
      ),
    );

    expect(result.name).toBe('Deluxe Tee');
    expect(result.basePriceCents).toBe(3000);
    expect(result.categoryIds).toEqual(['category-2']);
  });

  it('throws NotFoundException when the product does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new UpdateProductCommand('missing', 'X', null, 100, 'USD', ['c-1']),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
