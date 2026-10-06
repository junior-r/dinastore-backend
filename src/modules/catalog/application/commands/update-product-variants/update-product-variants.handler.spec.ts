import { NotFoundException } from '@nestjs/common';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { createMockProductRepository } from '@/modules/catalog/testing/mock-product-repository';
import { UpdateProductVariantsCommand } from './update-product-variants.command';
import { UpdateProductVariantsHandler } from './update-product-variants.handler';

describe('UpdateProductVariantsHandler', () => {
  let repository: jest.Mocked<ProductRepository>;
  let handler: UpdateProductVariantsHandler;

  beforeEach(() => {
    repository = createMockProductRepository();
    handler = new UpdateProductVariantsHandler(repository);
  });

  function existingProduct() {
    return Product.create({
      name: 'Classic Tee',
      slug: 'classic-tee',
      description: null,
      basePriceCents: 2500,
      currency: 'USD',
      categoryIds: ['category-1'],
      variants: [
        {
          size: 'M',
          color: 'black',
          sku: 'TEE-M-BLK',
          stock: 10,
          priceCents: null,
        },
      ],
    });
  }

  it('updates stock on an existing variant and persists the resolved list', async () => {
    const product = existingProduct();
    const existingId = product.variants[0].id;
    repository.findById.mockResolvedValue(product);
    repository.updateVariants.mockImplementation((_id, variants) =>
      Promise.resolve(
        Product.fromPersistence({ ...product.toPersistenceProps(), variants }),
      ),
    );

    const result = await handler.execute(
      new UpdateProductVariantsCommand(product.id, [
        { id: existingId, stock: 3, priceCents: null },
      ]),
    );

    expect(repository.updateVariants).toHaveBeenCalledWith(
      product.id,
      expect.arrayContaining([
        expect.objectContaining({ id: existingId, stock: 3 }),
      ]),
    );
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].stock).toBe(3);
  });

  it('creates a new variant alongside the kept existing one', async () => {
    const product = existingProduct();
    const existingId = product.variants[0].id;
    repository.findById.mockResolvedValue(product);
    repository.updateVariants.mockImplementation((_id, variants) =>
      Promise.resolve(
        Product.fromPersistence({ ...product.toPersistenceProps(), variants }),
      ),
    );

    const result = await handler.execute(
      new UpdateProductVariantsCommand(product.id, [
        { id: existingId, stock: 10, priceCents: null },
        {
          size: 'M',
          color: 'blue',
          sku: 'TEE-M-BLU',
          stock: 4,
          priceCents: null,
        },
      ]),
    );

    expect(result.variants).toHaveLength(2);
    expect(result.variants.map((v) => v.color)).toEqual(
      expect.arrayContaining(['black', 'blue']),
    );
  });

  it('drops an existing variant left out of the submitted list', async () => {
    const product = existingProduct();
    repository.findById.mockResolvedValue(product);
    repository.updateVariants.mockImplementation((_id, variants) =>
      Promise.resolve(
        Product.fromPersistence({ ...product.toPersistenceProps(), variants }),
      ),
    );

    const result = await handler.execute(
      new UpdateProductVariantsCommand(product.id, []),
    );

    expect(repository.updateVariants).toHaveBeenCalledWith(product.id, []);
    expect(result.variants).toHaveLength(0);
  });

  it('rejects an id that does not belong to this product', async () => {
    const product = existingProduct();
    repository.findById.mockResolvedValue(product);

    await expect(
      handler.execute(
        new UpdateProductVariantsCommand(product.id, [
          { id: 'not-a-real-variant', stock: 1, priceCents: null },
        ]),
      ),
    ).rejects.toThrow('not found on this product');
    expect(repository.updateVariants).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the product does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateProductVariantsCommand('missing', [])),
    ).rejects.toThrow(NotFoundException);
  });
});
