import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CATEGORY_REPOSITORY } from '@/modules/catalog/domain/repositories/category.repository';
import type { CategoryRepository } from '@/modules/catalog/domain/repositories/category.repository';
import { DeleteCategoryCommand } from './delete-category.command';

@CommandHandler(DeleteCategoryCommand)
export class DeleteCategoryHandler implements ICommandHandler<
  DeleteCategoryCommand,
  void
> {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepository: CategoryRepository,
  ) {}

  async execute(command: DeleteCategoryCommand): Promise<void> {
    const existing = await this.categoryRepository.findById(command.categoryId);
    if (!existing) {
      throw new NotFoundException(`Category "${command.categoryId}" not found`);
    }

    const orphaned =
      await this.categoryRepository.findProductsThatWouldBeOrphaned(
        command.categoryId,
      );
    if (orphaned.length > 0) {
      const names = orphaned.map((product) => product.name).join(', ');
      throw new ConflictException(
        `Cannot delete this category: it is the only category on ${orphaned.length} product(s) (${names}). Assign them another category first.`,
      );
    }

    await this.categoryRepository.delete(command.categoryId);
  }
}
