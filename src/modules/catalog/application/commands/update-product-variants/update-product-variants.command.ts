import { UpdateVariantsEntry } from '@/modules/catalog/domain/entities/product.entity';

export class UpdateProductVariantsCommand {
  constructor(
    public readonly productId: string,
    public readonly variants: UpdateVariantsEntry[],
  ) {}
}
