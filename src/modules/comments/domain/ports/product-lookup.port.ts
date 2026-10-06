export const PRODUCT_LOOKUP_PORT = Symbol('PRODUCT_LOOKUP_PORT');

/**
 * Narrow read-only port into Catalog — mirrors Orders' ProductCatalogPort
 * pattern so Comments doesn't depend on Catalog's ProductRepository directly.
 */
export interface ProductLookupPort {
  exists(productId: string): Promise<boolean>;
}
