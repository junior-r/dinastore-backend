import {
  Product,
  ProductStatus,
} from '@/modules/catalog/domain/entities/product.entity';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { createMockProductRepository } from '@/modules/catalog/testing/mock-product-repository';
import { GetProductsHandler } from './get-products.handler';
import { GetProductsQuery } from './get-products.query';

describe('GetProductsHandler', () => {
  let repository: jest.Mocked<ProductRepository>;
  let handler: GetProductsHandler;

  beforeEach(() => {
    repository = createMockProductRepository();
    handler = new GetProductsHandler(repository);
  });

  it('paginates using skip/take derived from page and pageSize', async () => {
    const product = Product.create({
      name: 'Classic Tee',
      slug: 'classic-tee',
      description: null,
      basePriceCents: 2500,
      currency: 'USD',
      categoryIds: ['category-1'],
    });
    repository.findMany.mockResolvedValue([product]);
    repository.count.mockResolvedValue(41);

    const result = await handler.execute(
      new GetProductsQuery(['category-1'], ProductStatus.PUBLISHED, 3, 20),
    );

    expect(repository.findMany).toHaveBeenCalledWith({
      categoryIds: ['category-1'],
      status: ProductStatus.PUBLISHED,
      skip: 40,
      take: 20,
    });
    expect(repository.count).toHaveBeenCalledWith({
      categoryIds: ['category-1'],
      status: ProductStatus.PUBLISHED,
    });
    expect(result).toEqual({
      items: [product],
      total: 41,
      page: 3,
      pageSize: 20,
    });
  });

  it('defaults to page 1, pageSize 20 and PUBLISHED status', async () => {
    repository.findMany.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    await handler.execute(new GetProductsQuery());

    expect(repository.findMany).toHaveBeenCalledWith({
      categoryIds: undefined,
      status: ProductStatus.PUBLISHED,
      skip: 0,
      take: 20,
    });
  });

  it('clamps a page of 0 or negative back to page 1 (never a negative skip)', async () => {
    repository.findMany.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    await handler.execute(
      new GetProductsQuery(undefined, ProductStatus.PUBLISHED, 0),
    );
    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );

    await handler.execute(
      new GetProductsQuery(undefined, ProductStatus.PUBLISHED, -5),
    );
    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });

  it('caps an oversized pageSize instead of passing it straight through', async () => {
    repository.findMany.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    await handler.execute(
      new GetProductsQuery(undefined, ProductStatus.PUBLISHED, 1, 10_000),
    );

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('passes the search term through to findMany and count', async () => {
    repository.findMany.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    await handler.execute(
      new GetProductsQuery(undefined, ProductStatus.PUBLISHED, 1, 20, 'hoodie'),
    );

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'hoodie' }),
    );
    expect(repository.count).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'hoodie' }),
    );
  });
});
