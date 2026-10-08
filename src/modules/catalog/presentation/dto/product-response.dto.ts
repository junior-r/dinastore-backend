import { Product } from '@/modules/catalog/domain/entities/product.entity';

export class ProductResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePriceCents: number;
  currency: string;
  status: string;
  categoryIds: string[];
  totalStock: number;
  variants: {
    id: string;
    size: string;
    color: string;
    sku: string;
    stock: number;
    priceCents: number | null;
  }[];
  images: {
    id: string;
    url: string;
    altText: string | null;
    position: number;
    variantIds: string[];
  }[];
  createdAt: Date;
  updatedAt: Date;

  static fromDomain(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.name = product.name;
    dto.slug = product.slug;
    dto.description = product.description;
    dto.basePriceCents = product.basePriceCents;
    dto.currency = product.currency;
    dto.status = product.status;
    dto.categoryIds = product.categoryIds;
    dto.totalStock = product.totalStock();
    dto.variants = product.variants;
    dto.images = product.images;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;
    return dto;
  }
}
