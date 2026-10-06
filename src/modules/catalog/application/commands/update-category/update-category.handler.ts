import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainError } from '@/shared/domain/domain-error';
import { Category } from '@/modules/catalog/domain/entities/category.entity';
import { CATEGORY_REPOSITORY } from '@/modules/catalog/domain/repositories/category.repository';
import type { CategoryRepository } from '@/modules/catalog/domain/repositories/category.repository';
import { UpdateCategoryCommand } from './update-category.command';

@CommandHandler(UpdateCategoryCommand)
export class UpdateCategoryHandler implements ICommandHandler<
  UpdateCategoryCommand,
  Category
> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(command: UpdateCategoryCommand): Promise<Category> {
    if (!command.name.trim()) {
      throw new DomainError('Category name cannot be empty');
    }

    const existing = await this.categoryRepository.findById(command.categoryId);
    if (!existing) {
      throw new NotFoundException(`Category "${command.categoryId}" not found`);
    }

    const bySlug = await this.categoryRepository.findBySlug(command.slug);
    if (bySlug && bySlug.id !== command.categoryId) {
      throw new ConflictException(
        `A category with slug "${command.slug}" already exists`,
      );
    }

    return this.categoryRepository.update({
      id: command.categoryId,
      name: command.name,
      slug: command.slug,
      description: command.description?.trim() || null,
    });
  }
}
