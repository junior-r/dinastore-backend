import type { ProductViewRepository } from '@/modules/analytics/domain/repositories/product-view.repository';
import { createMockProductViewRepository } from '@/modules/analytics/testing/mock-product-view-repository';
import {
  GetProductViewsByProductHandler,
  GetProductViewsByVisitorHandler,
} from './get-product-view-groups.handler';
import {
  GetProductViewsByProductQuery,
  GetProductViewsByVisitorQuery,
} from './get-product-view-groups.query';

describe('grouped product views', () => {
  let views: jest.Mocked<ProductViewRepository>;

  beforeEach(() => {
    views = createMockProductViewRepository();
    views.groupByProduct.mockResolvedValue([]);
    views.countProducts.mockResolvedValue(0);
    views.groupByVisitor.mockResolvedValue([]);
    views.countVisitors.mockResolvedValue(0);
  });

  it('pages the per-product groups and counts groups, not visits', async () => {
    views.countProducts.mockResolvedValue(12);

    const result = await new GetProductViewsByProductHandler(views).execute(
      new GetProductViewsByProductQuery(2, 5, { country: 'VE' }),
    );

    expect(views.groupByProduct).toHaveBeenCalledWith({
      country: 'VE',
      skip: 5,
      take: 5,
    });
    expect(views.countProducts).toHaveBeenCalledWith({ country: 'VE' });
    expect(result).toEqual({ items: [], total: 12, page: 2, pageSize: 5 });
  });

  it('pages the per-visitor groups the same way', async () => {
    views.countVisitors.mockResolvedValue(3);

    const result = await new GetProductViewsByVisitorHandler(views).execute(
      new GetProductViewsByVisitorQuery(1, 500, { favorited: true }),
    );

    // Page size is clamped to the same ceiling as the visit list.
    expect(views.groupByVisitor).toHaveBeenCalledWith({
      favorited: true,
      skip: 0,
      take: 100,
    });
    expect(result).toMatchObject({ total: 3, pageSize: 100 });
  });
});
