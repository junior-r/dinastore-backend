import { UpdateImagesEntry } from '@/modules/catalog/domain/entities/product.entity';

export class UpdateProductImagesCommand {
  constructor(
    public readonly productId: string,
    public readonly images: UpdateImagesEntry[],
  ) {}
}
