import { ProductStatus } from '@/modules/catalog/domain/entities/product.entity';

const MAX_PAGE_SIZE = 100;

export class GetProductsQuery {
  public readonly page: number;
  public readonly pageSize: number;

  constructor(
    public readonly categoryIds?: string[],
    public readonly status: ProductStatus = ProductStatus.PUBLISHED,
    page = 1,
    pageSize = 20,
    public readonly search?: string,
  ) {
    this.page = Number.isInteger(page) && page >= 1 ? page : 1;
    this.pageSize =
      Number.isInteger(pageSize) && pageSize >= 1
        ? Math.min(pageSize, MAX_PAGE_SIZE)
        : 20;
  }
}
