import { ConflictException, NotFoundException } from '@nestjs/common';
import type { CategoryRepository } from '@/modules/catalog/domain/repositories/category.repository';
import { createMockCategoryRepository } from '@/modules/catalog/testing/mock-category-repository';
import { UpdateCategoryCommand } from './update-category.command';
import { UpdateCategoryHandler } from './update-category.handler';

describe('UpdateCategoryHandler', () => {
  let repository: jest.Mocked<CategoryRepository>;
  let handler: UpdateCategoryHandler;

  beforeEach(() => {
    repository = createMockCategoryRepository();
    handler = new UpdateCategoryHandler(repository);
  });

  it('updates the category when it exists and the slug is free', async () => {
    repository.findById.mockResolvedValue({
      id: 'cat-1',
      name: 'Old Name',
      slug: 'old-slug',
      description: null,
    });
    repository.findBySlug.mockResolvedValue(null);
    repository.update.mockImplementation((category) =>
      Promise.resolve(category),
    );

    const result = await handler.execute(
      new UpdateCategoryCommand('cat-1', 'New Name', 'new-slug'),
    );

    expect(result).toEqual({
      id: 'cat-1',
      name: 'New Name',
      slug: 'new-slug',
      description: null,
    });
  });

  it('stores an updated description, trimmed', async () => {
    repository.findById.mockResolvedValue({
      id: 'cat-1',
      name: 'Old Name',
      slug: 'same-slug',
      description: null,
    });
    repository.findBySlug.mockResolvedValue(null);
    repository.update.mockImplementation((category) =>
      Promise.resolve(category),
    );

    const result = await handler.execute(
      new UpdateCategoryCommand(
        'cat-1',
        'New Name',
        'same-slug',
        '  Updated blurb  ',
      ),
    );

    expect(result.description).toBe('Updated blurb');
  });

  it('allows keeping the same slug on the same category', async () => {
    repository.findById.mockResolvedValue({
      id: 'cat-1',
      name: 'Old Name',
      slug: 'same-slug',
      description: null,
    });
    repository.findBySlug.mockResolvedValue({
      id: 'cat-1',
      name: 'Old Name',
      slug: 'same-slug',
      description: null,
    });
    repository.update.mockImplementation((category) =>
      Promise.resolve(category),
    );

    await expect(
      handler.execute(
        new UpdateCategoryCommand('cat-1', 'New Name', 'same-slug'),
      ),
    ).resolves.toMatchObject({ name: 'New Name' });
  });

  it('throws NotFoundException when the category does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new UpdateCategoryCommand('missing', 'X', 'x')),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a slug already used by a different category', async () => {
    repository.findById.mockResolvedValue({
      id: 'cat-1',
      name: 'Old',
      slug: 'old-slug',
      description: null,
    });
    repository.findBySlug.mockResolvedValue({
      id: 'cat-2',
      name: 'Other',
      slug: 'taken-slug',
      description: null,
    });

    await expect(
      handler.execute(new UpdateCategoryCommand('cat-1', 'New', 'taken-slug')),
    ).rejects.toThrow(ConflictException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
