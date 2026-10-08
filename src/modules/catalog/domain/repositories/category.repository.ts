import { Category } from '../entities/category.entity';

export const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

export interface OrphanedProductSummary {
  id: string;
  name: string;
}

export interface CategoryRepository {
  findMany(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
  create(category: Category): Promise<Category>;
  update(category: Category): Promise<Category>;
  delete(id: string): Promise<void>;
  /**
   * Products for which `categoryId` is their *only* category -- deleting it
   * would leave them with zero categories, violating Product's "at least
   * one category" invariant. DeleteCategoryHandler rejects the delete
   * (409) when this is non-empty rather than silently orphaning them.
   */
  findProductsThatWouldBeOrphaned(
    categoryId: string,
  ): Promise<OrphanedProductSummary[]>;
}
