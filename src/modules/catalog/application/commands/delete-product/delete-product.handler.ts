import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY } from '@/modules/catalog/domain/repositories/product.repository';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { DeleteProductCommand } from './delete-product.command';

@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler implements ICommandHandler<
  DeleteProductCommand,
  void
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(command: DeleteProductCommand): Promise<void> {
    const product = await this.productRepository.findById(command.productId);
    if (!product) {
      throw new NotFoundException(`Product "${command.productId}" not found`);
    }
    // Comments cascade-delete at the DB level (onDelete: Cascade); Orders'
    // OrderItem has no FK to Product/ProductVariant by design (snapshots
    // data at order time), so existing orders stay intact.
    await this.productRepository.delete(command.productId);
  }
}
