import { ConflictException, NotFoundException } from '@nestjs/common';
import type { CategoryRepository } from '@/modules/catalog/domain/repositories/category.repository';
import { createMockCategoryRepository } from '@/modules/catalog/testing/mock-category-repository';
import { DeleteCategoryCommand } from './delete-category.command';
import { DeleteCategoryHandler } from './delete-category.handler';

describe('DeleteCategoryHandler', () => {
  let repository: jest.Mocked<CategoryRepository>;
  let handler: DeleteCategoryHandler;

  beforeEach(() => {
    repository = createMockCategoryRepository();
    handler = new DeleteCategoryHandler(repository);
  });

  it('deletes the category when nothing would be orphaned', async () => {
    repository.findById.mockResolvedValue({
      id: 'cat-1',
      name: 'Apparel',
      slug: 'apparel',
      description: null,
    });
    repository.findProductsThatWouldBeOrphaned.mockResolvedValue([]);

    await handler.execute(new DeleteCategoryCommand('cat-1'));

    expect(repository.delete).toHaveBeenCalledWith('cat-1');
  });

  it('throws NotFoundException when the category does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new DeleteCategoryCommand('missing')),
    ).rejects.toThrow(NotFoundException);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('rejects the delete when it would orphan a product, naming it', async () => {
    repository.findById.mockResolvedValue({
      id: 'cat-1',
      name: 'Apparel',
      slug: 'apparel',
      description: null,
    });
    repository.findProductsThatWouldBeOrphaned.mockResolvedValue([
      { id: 'prod-1', name: 'Classic Tee' },
    ]);

    await expect(
      handler.execute(new DeleteCategoryCommand('cat-1')),
    ).rejects.toThrow(ConflictException);
    await expect(
      handler.execute(new DeleteCategoryCommand('cat-1')),
    ).rejects.toThrow(/Classic Tee/);
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
