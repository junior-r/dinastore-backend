import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainError } from '@/shared/domain/domain-error';
import { slugify } from '@/shared/domain/slugify';
import { Category } from '@/modules/catalog/domain/entities/category.entity';
import { CATEGORY_REPOSITORY } from '@/modules/catalog/domain/repositories/category.repository';
import type { CategoryRepository } from '@/modules/catalog/domain/repositories/category.repository';
import { CreateCategoryCommand } from './create-category.command';

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler implements ICommandHandler<
  CreateCategoryCommand,
  Category
> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<Category> {
    if (!command.name.trim()) {
      throw new DomainError('Category name cannot be empty');
    }

    const slug = await this.generateUniqueSlug(command.name);

    return this.categoryRepository.create({
      id: crypto.randomUUID(),
      name: command.name,
      slug,
      description: command.description?.trim() || null,
    });
  }

  // Appends -2, -3, ... to the base slug until an unused one is found —
  // the client no longer supplies a slug, so a collision (e.g. two
  // categories both named "New") must be resolved here instead of
  // rejected with a 409 the caller can't act on.
  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || 'category';
    let candidate = base;
    let suffix = 2;
    while (await this.categoryRepository.findBySlug(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}
