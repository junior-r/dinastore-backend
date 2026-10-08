import { ProductStatus } from '@/modules/catalog/domain/entities/product.entity';

const MAX_PAGE_SIZE = 100;

// Distinct from GetProductsQuery (the public storefront listing, which
// defaults to PUBLISHED-only): admin listings show every status by default
// -- `status` here is a genuine filter, not a default to fall back to.
export class GetAdminProductsQuery {
  public readonly page: number;
  public readonly pageSize: number;

  constructor(
    public readonly categoryIds?: string[],
    public readonly status?: ProductStatus,
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
