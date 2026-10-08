export const VIEWED_PRODUCT_PORT = Symbol('VIEWED_PRODUCT_PORT');

/**
 * Narrow read-only port into Catalog, same idea as Comments'
 * ProductLookupPort and Orders' ProductCatalogPort: Analytics needs to know a
 * product exists and what it is called, and nothing else about it.
 */
export interface ViewedProductPort {
  /** The product's current name, or null if there is no such product. */
  findName(productId: string): Promise<string | null>;
}
