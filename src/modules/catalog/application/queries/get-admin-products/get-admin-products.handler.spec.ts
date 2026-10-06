import {
  Product,
  ProductStatus,
} from '@/modules/catalog/domain/entities/product.entity';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { createMockProductRepository } from '@/modules/catalog/testing/mock-product-repository';
import { GetAdminProductsHandler } from './get-admin-products.handler';
import { GetAdminProductsQuery } from './get-admin-products.query';

describe('GetAdminProductsHandler', () => {
  let repository: jest.Mocked<ProductRepository>;
  let handler: GetAdminProductsHandler;

  beforeEach(() => {
    repository = createMockProductRepository();
    handler = new GetAdminProductsHandler(repository);
  });

  it('defaults to no status filter (all statuses), unlike the public GetProductsQuery', async () => {
    repository.findMany.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    await handler.execute(new GetAdminProductsQuery());

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined }),
    );
  });

  it('applies an explicit status filter when given one', async () => {
    const draft = Product.create({
      name: 'Draft product',
      slug: 'draft-product',
      description: null,
      basePriceCents: 1000,
      currency: 'USD',
      categoryIds: ['category-1'],
    });
    repository.findMany.mockResolvedValue([draft]);
    repository.count.mockResolvedValue(1);

    const result = await handler.execute(
      new GetAdminProductsQuery(undefined, ProductStatus.DRAFT),
    );

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: ProductStatus.DRAFT }),
    );
    expect(result.items).toEqual([draft]);
  });
});
