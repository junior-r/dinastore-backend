import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { PRODUCT_REPOSITORY } from '@/modules/catalog/domain/repositories/product.repository';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { GetAdminProductsQuery } from './get-admin-products.query';

export interface PaginatedAdminProducts {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

@QueryHandler(GetAdminProductsQuery)
export class GetAdminProductsHandler implements IQueryHandler<
  GetAdminProductsQuery,
  PaginatedAdminProducts
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(query: GetAdminProductsQuery): Promise<PaginatedAdminProducts> {
    const skip = (query.page - 1) * query.pageSize;
    const params = {
      categoryIds: query.categoryIds,
      status: query.status,
      search: query.search,
    };

    const [items, total] = await Promise.all([
      this.productRepository.findMany({
        ...params,
        skip,
        take: query.pageSize,
      }),
      this.productRepository.count(params),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
