import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { clampPage } from '@/modules/analytics/application/paging';
import { PRODUCT_VIEW_REPOSITORY } from '@/modules/analytics/domain/repositories/product-view.repository';
import type {
  ProductViewListItem,
  ProductViewRepository,
} from '@/modules/analytics/domain/repositories/product-view.repository';
import { GetProductViewsQuery } from './get-product-views.query';

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
    const { page, pageSize, skip } = clampPage(query.page, query.pageSize);

    const [items, total] = await Promise.all([
      this.viewRepository.findMany({ ...query.filter, skip, take: pageSize }),
      this.viewRepository.count(query.filter),
    ]);

    return { items, total, page, pageSize };
  }
}
