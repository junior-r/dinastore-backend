# Catalog

Manages the product catalog: products, categories, variants (size/color/SKU/stock), and product images. The most complete vertical slice in the codebase — the reference implementation for the DDD/CQRS module pattern (see `docs/architecture.md`).

Source: `src/modules/catalog/`

## Entities

- **`Product`** (`domain/entities/product.entity.ts`) — invariants: non-negative `basePriceCents`, non-empty `name`, at least one `categoryId`; each variant needs non-blank `sku`/`size`/`color`, non-negative `stock`/`priceCents`, and no two variants share the same size+color. Starts life as `ProductStatus.DRAFT`; `changeStatus()` transitions it. `update()` deliberately never touches `variants` — see the note below.
- **`Category`** (`domain/entities/category.entity.ts`) — a plain read model/value object (`id`, `name`, `slug`, `description`), no invariants of its own beyond the DB's unique-slug constraint. Slug is always backend-generated from `name`, never client-supplied, using `shared/domain/slugify.ts` (NFKD-normalize, strip diacritics, collision-resolve with `-2`, `-3`, ...).
- **`ProductVariant`** / **`ProductImage`** — plain prop shapes owned by `Product`, not separate aggregates.

**Product ↔ Category is many-to-many** (a Prisma implicit m2m via `_CategoryToProduct`), so a product can carry several tags (e.g. "Superheroes" + "Boys"). `Product.categoryIds: string[]` on the domain entity.

## Endpoints

Public (`CatalogController`, `/catalog`):
- `GET /catalog/categories` — flat list, no filters.
- `GET /catalog/products` — paginated, `?categoryIds=id1,id2` (OR semantics — matches if the product has *any* requested category), defaults to `PUBLISHED` only.
- `GET /catalog/products/:slug`
- `POST /catalog/products` — creates a product (**always starts `DRAFT`**); guarded (`ADMIN`/`STAFF` + `products:manage`) — this route used to be completely unauthenticated, closed as a security fix.
- `POST /catalog/products/images` — uploads product image files ahead of product creation (multipart, up to 10 files via `FilesInterceptor`), returns public URLs to attach to the create payload; same guard as product creation.

Admin (`AdminCatalogController`, `/admin/catalog`, all guarded `ADMIN`/`STAFF` + specific permission):
- `GET /admin/catalog/products` (`products:view`) — all statuses, unlike the public listing.
- `PATCH /admin/catalog/products/:id` (`products:manage`) — name/description/price/currency/categories only, deliberately **does not touch variants**.
- `PATCH /admin/catalog/products/:id/status` (`products:manage`)
- `DELETE /admin/catalog/products/:id` (`products:manage`)
- `POST` / `PATCH` / `DELETE /admin/catalog/categories` (`categories:manage`) — deleting a category that would leave a product with zero categories is rejected with 409, naming the affected products.

## CQRS

Commands: `CreateProductCommand`, `UpdateProductCommand`, `UpdateProductStatusCommand`, `DeleteProductCommand`, `CreateCategoryCommand`, `UpdateCategoryCommand`, `DeleteCategoryCommand`.
Queries: `GetProductsQuery` (public, paginated, clamps page/pageSize itself — not just at the DTO layer), `GetAdminProductsQuery`, `GetProductBySlugQuery`, `GetCategoriesQuery`.

## Notable business logic

- Connecting a product to a nonexistent category id surfaces as **404** (Prisma `P2025` on the `categories: { connect }` write via `PrismaExceptionFilter`), not 400.
- Admin product edits never regenerate variant ids, because carts key line items by `productVariantId` — regenerating them on a simple detail edit would silently break items already in a customer's cart.
- Image uploads: `infrastructure/uploads/product-image-storage.ts` provides the Multer storage config and a helper to build the public `/uploads/...` URL, served statically by `main.ts`.

## Interaction with other modules

- **Orders** depends on Catalog through its own narrow `ProductCatalogPort` (implemented against Catalog's Prisma tables), not Catalog's `ProductRepository` directly.
- **Comments** depends on Catalog through `ProductLookupPort.exists(productId)`.
- **Users** guards (`RolesGuard`, `PermissionsGuard`) protect the admin/product-mutation routes here.
