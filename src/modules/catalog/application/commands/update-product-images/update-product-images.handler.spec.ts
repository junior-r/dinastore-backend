import { NotFoundException } from '@nestjs/common';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { createMockProductRepository } from '@/modules/catalog/testing/mock-product-repository';
import { UpdateProductImagesCommand } from './update-product-images.command';
import { UpdateProductImagesHandler } from './update-product-images.handler';

describe('UpdateProductImagesHandler', () => {
  let repository: jest.Mocked<ProductRepository>;
  let handler: UpdateProductImagesHandler;

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

  beforeEach(() => {
    repository = createMockProductRepository();
    handler = new UpdateProductImagesHandler(repository);
  });

  it('adds a new image tagged to an existing variant', async () => {
    const product = existingProduct();
    const variantId = product.variants[0].id;
    repository.findById.mockResolvedValue(product);
    repository.updateImages.mockImplementation((_id, images) =>
      Promise.resolve(
        Product.fromPersistence({ ...product.toPersistenceProps(), images }),
      ),
    );

    const result = await handler.execute(
      new UpdateProductImagesCommand(product.id, [
        {
          url: 'https://example.com/black.png',
          altText: null,
          position: 0,
          variantIds: [variantId],
        },
      ]),
    );

    expect(result.images).toHaveLength(1);
    expect(result.images[0].variantIds).toEqual([variantId]);
  });

  it('rejects an image tagged to a variant id that does not belong to this product', async () => {
    const product = existingProduct();
    repository.findById.mockResolvedValue(product);

    await expect(
      handler.execute(
        new UpdateProductImagesCommand(product.id, [
          {
            url: 'https://example.com/x.png',
            altText: null,
            position: 0,
            variantIds: ['not-real'],
          },
        ]),
      ),
    ).rejects.toThrow("doesn't exist on this product");
    expect(repository.updateImages).not.toHaveBeenCalled();
  });

  it('drops an existing image left out of the submitted list', async () => {
    const product = existingProduct();
    repository.findById.mockResolvedValue(product);
    repository.updateImages.mockImplementation((_id, images) =>
      Promise.resolve(
        Product.fromPersistence({ ...product.toPersistenceProps(), images }),
      ),
    );

    const result = await handler.execute(
      new UpdateProductImagesCommand(product.id, []),
    );

    expect(repository.updateImages).toHaveBeenCalledWith(product.id, []);
    expect(result.images).toHaveLength(0);
  });

  it('throws NotFoundException when the product does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateProductImagesCommand('missing', [])),
    ).rejects.toThrow(NotFoundException);
  });
});
