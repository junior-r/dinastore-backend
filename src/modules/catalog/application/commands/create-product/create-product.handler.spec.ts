import { ConflictException } from '@nestjs/common';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { createMockProductRepository } from '@/modules/catalog/testing/mock-product-repository';
import { CreateProductCommand } from './create-product.command';
import { CreateProductHandler } from './create-product.handler';

describe('CreateProductHandler', () => {
  let repository: jest.Mocked<ProductRepository>;
  let handler: CreateProductHandler;

  beforeEach(() => {
    repository = createMockProductRepository();
    handler = new CreateProductHandler(repository);
  });

  const command = new CreateProductCommand(
    'Classic Tee',
    'classic-tee',
    null,
    2500,
    'USD',
    ['category-1'],
    [
      {
        size: 'M',
        color: 'black',
        sku: 'TEE-M-BLK',
        stock: 10,
        priceCents: null,
      },
    ],
  );

  it('creates a new product when the slug is not taken', async () => {
    repository.slugExists.mockResolvedValue(false);
    repository.create.mockImplementation((product) => Promise.resolve(product));

    const result = await handler.execute(command);

    expect(repository.slugExists).toHaveBeenCalledWith('classic-tee');
    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(Product);
    expect(result.name).toBe('Classic Tee');
    expect(result.variants).toHaveLength(1);
  });

  it('throws a ConflictException when the slug already exists', async () => {
    repository.slugExists.mockResolvedValue(true);

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });
});
