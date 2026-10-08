import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PRODUCT_VIEW_REPOSITORY } from '@/modules/analytics/domain/repositories/product-view.repository';
import type {
  ProductViewListItem,
  ProductViewRepository,
} from '@/modules/analytics/domain/repositories/product-view.repository';
import { GetProductViewsQuery } from './get-product-views.query';

const MAX_PAGE_SIZE = 100;

export interface PaginatedProductViews {
  items: ProductViewListItem[];
  total: number;
  page: number;
  pageSize: number;
}

@QueryHandler(GetProductViewsQuery)
export class GetProductViewsHandler implements IQueryHandler<
  GetProductViewsQuery,
  PaginatedProductViews
> {
  constructor(
    @Inject(PRODUCT_VIEW_REPOSITORY)
    private readonly viewRepository: ProductViewRepository,
  ) {}

  async execute(query: GetProductViewsQuery): Promise<PaginatedProductViews> {
    // Clamped here as well as in the DTO: the handler is callable from
    // anywhere in the app, not only through the validated HTTP route.
    const page = Math.max(1, Math.trunc(query.page));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.trunc(query.pageSize)),
    );
    const filter = { productId: query.productId };

    const [items, total] = await Promise.all([
      this.viewRepository.findMany({
        ...filter,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.viewRepository.count(filter),
    ]);

    return { items, total, page, pageSize };
  }
}
