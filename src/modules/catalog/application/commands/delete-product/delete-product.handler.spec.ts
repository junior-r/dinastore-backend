import { NotFoundException } from '@nestjs/common';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { createMockProductRepository } from '@/modules/catalog/testing/mock-product-repository';
import { DeleteProductCommand } from './delete-product.command';
import { DeleteProductHandler } from './delete-product.handler';

describe('DeleteProductHandler', () => {
  let repository: jest.Mocked<ProductRepository>;
  let handler: DeleteProductHandler;

  beforeEach(() => {
    repository = createMockProductRepository();
    handler = new DeleteProductHandler(repository);
  });

  it('deletes the product when it exists', async () => {
    const product = Product.create({
      name: 'Classic Tee',
      slug: 'classic-tee',
      description: null,
      basePriceCents: 2500,
      currency: 'USD',
      categoryIds: ['category-1'],
    });
    repository.findById.mockResolvedValue(product);

    await handler.execute(new DeleteProductCommand(product.id));

    expect(repository.delete).toHaveBeenCalledWith(product.id);
  });

  it('throws NotFoundException when the product does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteProductCommand('missing')),
    ).rejects.toThrow(NotFoundException);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
