import { ProductStatus } from '@/modules/catalog/domain/entities/product.entity';

export class UpdateProductStatusCommand {
  constructor(
    public readonly productId: string,
    public readonly status: ProductStatus,
  ) {}
}
