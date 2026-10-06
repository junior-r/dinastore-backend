import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { PRODUCT_REPOSITORY } from '@/modules/catalog/domain/repositories/product.repository';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { UpdateProductStatusCommand } from './update-product-status.command';

@CommandHandler(UpdateProductStatusCommand)
export class UpdateProductStatusHandler implements ICommandHandler<
  UpdateProductStatusCommand,
  Product
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(command: UpdateProductStatusCommand): Promise<Product> {
    const product = await this.productRepository.findById(command.productId);
    if (!product) {
      throw new NotFoundException(`Product "${command.productId}" not found`);
    }

    return this.productRepository.update(product.changeStatus(command.status));
  }
}
