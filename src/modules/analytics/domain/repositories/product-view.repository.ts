import type { ProductView } from '../entities/product-view.entity';

export const PRODUCT_VIEW_REPOSITORY = Symbol('PRODUCT_VIEW_REPOSITORY');

export interface ProductViewFilter {
  /** Only visits to this product. */
  productId?: string;
}

/**
 * A view as the admin history shows it: the visit itself plus the two things
 * read live at query time rather than stored on the row.
 */
export interface ProductViewListItem {
  view: ProductView;
  /** Null for an anonymous visit, or once the account has been deleted. */
  user: { id: string; name: string; email: string } | null;
  /** Null once the product has been deleted; lets the UI link to it otherwise. */
  productSlug: string | null;
}

export interface ProductViewRepository {
  findById(id: string): Promise<ProductView | null>;
  /** Inserts the view, or updates it if a row with its id already exists. */
  save(view: ProductView): Promise<void>;
  /** Newest visit first. */
  findMany(
    filter: ProductViewFilter & { skip: number; take: number },
  ): Promise<ProductViewListItem[]>;
  count(filter: ProductViewFilter): Promise<number>;
}
