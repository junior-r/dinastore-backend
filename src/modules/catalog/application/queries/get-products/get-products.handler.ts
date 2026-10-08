import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { PRODUCT_REPOSITORY } from '@/modules/catalog/domain/repositories/product.repository';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { GetProductsQuery } from './get-products.query';

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

@QueryHandler(GetProductsQuery)
export class GetProductsHandler implements IQueryHandler<
  GetProductsQuery,
  PaginatedProducts
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(query: GetProductsQuery): Promise<PaginatedProducts> {
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
