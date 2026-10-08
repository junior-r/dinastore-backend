// A plain read model, not a full aggregate — carries no invariants of its
// own beyond the DB's unique slug constraint. Slug is always
// backend-generated from `name` on create (see CreateCategoryHandler).
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}
