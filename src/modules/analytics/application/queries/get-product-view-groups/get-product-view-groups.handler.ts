import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { clampPage } from '@/modules/analytics/application/paging';
import type {
  ProductViewGroup,
  VisitorViewGroup,
} from '@/modules/analytics/domain/product-view-stats';
import { PRODUCT_VIEW_REPOSITORY } from '@/modules/analytics/domain/repositories/product-view.repository';
import type { ProductViewRepository } from '@/modules/analytics/domain/repositories/product-view.repository';
import {
  GetProductViewsByProductQuery,
  GetProductViewsByVisitorQuery,
} from './get-product-view-groups.query';

export interface PaginatedGroups<T> {
  items: T[];
  /** Number of groups (products, or people), not of visits. */
  total: number;
  page: number;
  pageSize: number;
}

@QueryHandler(GetProductViewsByProductQuery)
export class GetProductViewsByProductHandler implements IQueryHandler<
  GetProductViewsByProductQuery,
  PaginatedGroups<ProductViewGroup>
> {
  constructor(
    @Inject(PRODUCT_VIEW_REPOSITORY)
    private readonly viewRepository: ProductViewRepository,
  ) {}

  async execute(
    query: GetProductViewsByProductQuery,
  ): Promise<PaginatedGroups<ProductViewGroup>> {
    const { page, pageSize, skip } = clampPage(query.page, query.pageSize);

    const [items, total] = await Promise.all([
      this.viewRepository.groupByProduct({
        ...query.filter,
        skip,
        take: pageSize,
      }),
      this.viewRepository.countProducts(query.filter),
    ]);

    return { items, total, page, pageSize };
  }
}

@QueryHandler(GetProductViewsByVisitorQuery)
export class GetProductViewsByVisitorHandler implements IQueryHandler<
  GetProductViewsByVisitorQuery,
  PaginatedGroups<VisitorViewGroup>
> {
  constructor(
    @Inject(PRODUCT_VIEW_REPOSITORY)
    private readonly viewRepository: ProductViewRepository,
  ) {}

  async execute(
    query: GetProductViewsByVisitorQuery,
  ): Promise<PaginatedGroups<VisitorViewGroup>> {
    const { page, pageSize, skip } = clampPage(query.page, query.pageSize);

    const [items, total] = await Promise.all([
      this.viewRepository.groupByVisitor({
        ...query.filter,
        skip,
        take: pageSize,
      }),
      this.viewRepository.countVisitors(query.filter),
    ]);

    return { items, total, page, pageSize };
  }
}
