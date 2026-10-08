import { ConflictException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { PRODUCT_REPOSITORY } from '@/modules/catalog/domain/repositories/product.repository';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { CreateProductCommand } from './create-product.command';

@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<
  CreateProductCommand,
  Product
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(command: CreateProductCommand): Promise<Product> {
    if (await this.productRepository.slugExists(command.slug)) {
      throw new ConflictException(
        `A product with slug "${command.slug}" already exists`,
      );
    }

    const product = Product.create({
      name: command.name,
      slug: command.slug,
      description: command.description,
      basePriceCents: command.basePriceCents,
      currency: command.currency,
      categoryIds: command.categoryIds,
      variants: command.variants,
      images: command.images,
    });

    return this.productRepository.create(product);
  }
}
