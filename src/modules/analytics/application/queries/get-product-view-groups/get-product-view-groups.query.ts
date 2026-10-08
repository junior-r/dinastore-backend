import type { ProductViewFilter } from '@/modules/analytics/domain/repositories/product-view.repository';

/** The same history, summed up per product or per person instead of per visit. */
export class GetProductViewsByProductQuery {
  constructor(
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
    public readonly filter: ProductViewFilter = {},
  ) {}
}

export class GetProductViewsByVisitorQuery {
  constructor(
    public readonly page: number = 1,
    public readonly pageSize: number = 20,
    public readonly filter: ProductViewFilter = {},
  ) {}
}
