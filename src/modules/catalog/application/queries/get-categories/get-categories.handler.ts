import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Category } from '@/modules/catalog/domain/entities/category.entity';
import { CATEGORY_REPOSITORY } from '@/modules/catalog/domain/repositories/category.repository';
import type { CategoryRepository } from '@/modules/catalog/domain/repositories/category.repository';
import { GetCategoriesQuery } from './get-categories.query';

@QueryHandler(GetCategoriesQuery)
export class GetCategoriesHandler implements IQueryHandler<
  GetCategoriesQuery,
  Category[]
> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(): Promise<Category[]> {
    return this.categoryRepository.findMany();
  }
}
