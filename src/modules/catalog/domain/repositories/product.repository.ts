import {
  Product,
  ProductImageProps,
  ProductStatus,
  ProductVariantProps,
} from '../entities/product.entity';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface FindProductsParams {
  categoryIds?: string[];
  status?: ProductStatus;
  search?: string;
  skip?: number;
  take?: number;
}

export interface ProductRepository {
  findMany(params: FindProductsParams): Promise<Product[]>;
  count(
    params: Pick<FindProductsParams, 'categoryIds' | 'status' | 'search'>,
  ): Promise<number>;
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  slugExists(slug: string): Promise<boolean>;
  create(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
  // Full-replace persistence for the resolved variants/images arrays a
  // domain `updateVariants`/`updateImages` call already produced -- any
  // current row whose id isn't in the array gets deleted.
  updateVariants(
    productId: string,
    variants: ProductVariantProps[],
  ): Promise<Product>;
  updateImages(
    productId: string,
    images: ProductImageProps[],
  ): Promise<Product>;
  delete(id: string): Promise<void>;
}
