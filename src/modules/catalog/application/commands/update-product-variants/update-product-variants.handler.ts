import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { PRODUCT_REPOSITORY } from '@/modules/catalog/domain/repositories/product.repository';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { UpdateProductVariantsCommand } from './update-product-variants.command';

@CommandHandler(UpdateProductVariantsCommand)
export class UpdateProductVariantsHandler implements ICommandHandler<
  UpdateProductVariantsCommand,
  Product
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(command: UpdateProductVariantsCommand): Promise<Product> {
    const product = await this.productRepository.findById(command.productId);
    if (!product) {
      throw new NotFoundException(`Product "${command.productId}" not found`);
    }

    const updated = product.updateVariants(command.variants);
    return this.productRepository.updateVariants(
      command.productId,
      updated.variants,
    );
  }
}
