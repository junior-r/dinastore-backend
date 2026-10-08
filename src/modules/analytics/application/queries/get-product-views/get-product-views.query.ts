import type { ProductViewFilter } from '@/modules/analytics/domain/repositories/product-view.repository';

export class GetProductViewsQuery {
  constructor(
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
    public readonly filter: ProductViewFilter = {},
  ) {}
}
