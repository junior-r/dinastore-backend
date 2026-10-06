import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Product } from '@/modules/catalog/domain/entities/product.entity';
import { PRODUCT_REPOSITORY } from '@/modules/catalog/domain/repositories/product.repository';
import type { ProductRepository } from '@/modules/catalog/domain/repositories/product.repository';
import { GetProductBySlugQuery } from './get-product-by-slug.query';

@QueryHandler(GetProductBySlugQuery)
export class GetProductBySlugHandler implements IQueryHandler<
  GetProductBySlugQuery,
  Product
> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(query: GetProductBySlugQuery): Promise<Product> {
    const product = await this.productRepository.findBySlug(query.slug);
    if (!product) {
      throw new NotFoundException(
        `Product with slug "${query.slug}" not found`,
      );
    }
    return product;
  }
}
