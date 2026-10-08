import {
  NewProductImageInput,
  ProductVariantProps,
} from '@/modules/catalog/domain/entities/product.entity';

export class CreateProductCommand {
  constructor(
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | null,
    public readonly basePriceCents: number,
    public readonly currency: string,
    public readonly categoryIds: string[],
    public readonly variants: Omit<ProductVariantProps, 'id'>[],
    public readonly images: NewProductImageInput[] = [],
  ) {}
}
