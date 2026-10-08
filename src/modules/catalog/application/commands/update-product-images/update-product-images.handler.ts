import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { PRODUCT_REPOSITORY } from '@/modules/catalog/domain/repositories/product.repository';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { UpdateProductImagesCommand } from './update-product-images.command';

@CommandHandler(UpdateProductImagesCommand)
export class UpdateProductImagesHandler implements ICommandHandler<
  UpdateProductImagesCommand,
  Product
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(command: UpdateProductImagesCommand): Promise<Product> {
    const product = await this.productRepository.findById(command.productId);
    if (!product) {
      throw new NotFoundException(`Product "${command.productId}" not found`);
    }

    const updated = product.updateImages(command.images);
    return this.productRepository.updateImages(
      command.productId,
      updated.images,
    );
  }
}
