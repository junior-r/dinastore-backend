export const PRODUCT_CATALOG_PORT = Symbol('PRODUCT_CATALOG_PORT');

export interface OrderableVariant {
  productVariantId: string;
  productId: string;
  productName: string;
  variantSize: string;
  variantColor: string;
  stock: number;
  unitPriceCents: number;
  currency: string;
  isPublished: boolean;
  /**
   * The photo the storefront shows first for this variant: the first image
   * tagged to it or to no variant, else the product's first image. The design
   * studio positions artwork on this same photo, so it is what a customized
   * line snapshots.
   */
  imageUrl: string | null;
}

/**
 * Read-only view of the Catalog domain that Orders needs to price and validate
 * a line item. Kept as a narrow port (not a direct dependency on Catalog's
 * ProductRepository) so Orders only depends on the slice of catalog data it
 * actually needs.
 */
export interface ProductCatalogPort {
  findVariantsByIds(productVariantIds: string[]): Promise<OrderableVariant[]>;
}
