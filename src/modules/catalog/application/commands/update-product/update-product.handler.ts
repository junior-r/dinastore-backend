import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { PRODUCT_REPOSITORY } from '@/modules/catalog/domain/repositories/product.repository';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { UpdateProductCommand } from './update-product.command';

@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler implements ICommandHandler<
  UpdateProductCommand,
  Product
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(command: UpdateProductCommand): Promise<Product> {
    const product = await this.productRepository.findById(command.productId);
    if (!product) {
      throw new NotFoundException(`Product "${command.productId}" not found`);
    }

    const updated = product.update({
      name: command.name,
      description: command.description,
      basePriceCents: command.basePriceCents,
      currency: command.currency,
      categoryIds: command.categoryIds,
    });

    return this.productRepository.update(updated);
  }
}
