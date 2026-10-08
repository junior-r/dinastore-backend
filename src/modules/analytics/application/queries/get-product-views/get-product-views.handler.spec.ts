import type { ProductViewRepository } from '@/modules/analytics/domain/repositories/product-view.repository';
import { createMockProductViewRepository } from '@/modules/analytics/testing/mock-product-view-repository';
import { GetProductViewsHandler } from './get-product-views.handler';
import { GetProductViewsQuery } from './get-product-views.query';

describe('GetProductViewsHandler', () => {
  let views: jest.Mocked<ProductViewRepository>;
  let handler: GetProductViewsHandler;

  beforeEach(() => {
    views = createMockProductViewRepository();
    handler = new GetProductViewsHandler(views);
    views.findMany.mockResolvedValue([]);
    views.count.mockResolvedValue(0);
  });

  it('pages through the history and reports the total', async () => {
    views.count.mockResolvedValue(57);

    const result = await handler.execute(new GetProductViewsQuery(3, 20));

    expect(views.findMany).toHaveBeenCalledWith({ skip: 40, take: 20 });
    expect(result).toEqual({ items: [], total: 57, page: 3, pageSize: 20 });
  });

  it('passes the filter to both the page and the count', async () => {
    await handler.execute(
      new GetProductViewsQuery(1, 20, { productId: 'product-1' }),
    );

    expect(views.findMany).toHaveBeenCalledWith({
      productId: 'product-1',
      skip: 0,
      take: 20,
    });
    expect(views.count).toHaveBeenCalledWith({ productId: 'product-1' });
  });

  it('clamps an out-of-range page and page size', async () => {
    const result = await handler.execute(new GetProductViewsQuery(0, 5000));

    expect(views.findMany).toHaveBeenCalledWith({ skip: 0, take: 100 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
  });
});
