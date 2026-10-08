import { DomainError } from '@/shared/domain/domain-error';
import type { CategoryRepository } from '@/modules/catalog/domain/repositories/category.repository';
import { createMockCategoryRepository } from '@/modules/catalog/testing/mock-category-repository';
import { CreateCategoryCommand } from './create-category.command';
import { CreateCategoryHandler } from './create-category.handler';

describe('CreateCategoryHandler', () => {
  let repository: jest.Mocked<CategoryRepository>;
  let handler: CreateCategoryHandler;

  beforeEach(() => {
    repository = createMockCategoryRepository();
    handler = new CreateCategoryHandler(repository);
  });

  it('creates a new category with a slug generated from the name', async () => {
    repository.findBySlug.mockResolvedValue(null);
    repository.create.mockImplementation((category) =>
      Promise.resolve(category),
    );

    const result = await handler.execute(
      new CreateCategoryCommand('Superheroes'),
    );

    expect(result.name).toBe('Superheroes');
    expect(result.slug).toBe('superheroes');
    expect(result.id).toEqual(expect.any(String));
  });

  it('stores an optional description, trimmed', async () => {
    repository.findBySlug.mockResolvedValue(null);
    repository.create.mockImplementation((category) =>
      Promise.resolve(category),
    );

    const result = await handler.execute(
      new CreateCategoryCommand('Superheroes', '  Capes and masks  '),
    );

    expect(result.description).toBe('Capes and masks');
  });

  it('stores a null description when none is given', async () => {
    repository.findBySlug.mockResolvedValue(null);
    repository.create.mockImplementation((category) =>
      Promise.resolve(category),
    );

    const result = await handler.execute(
      new CreateCategoryCommand('Superheroes'),
    );

    expect(result.description).toBeNull();
  });

  it('rejects a blank name', async () => {
    await expect(
      handler.execute(new CreateCategoryCommand('   ')),
    ).rejects.toThrow(DomainError);
    expect(repository.findBySlug).not.toHaveBeenCalled();
  });

  it('appends a numeric suffix when the generated slug is already taken', async () => {
    repository.findBySlug.mockImplementation((slug) =>
      Promise.resolve(
        slug === 'superheroes'
          ? {
              id: 'existing',
              name: 'Existing',
              slug: 'superheroes',
              description: null,
            }
          : null,
      ),
    );
    repository.create.mockImplementation((category) =>
      Promise.resolve(category),
    );

    const result = await handler.execute(
      new CreateCategoryCommand('Superheroes'),
    );

    expect(result.slug).toBe('superheroes-2');
  });
});
