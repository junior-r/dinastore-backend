# Code Standards

These conventions are derived from `../CLAUDE.md` and from patterns observed consistently across `src/`. When in doubt, mirror the closest existing module — Catalog, Orders, and Comments are called out in `CLAUDE.md` as the reference implementations for any new domain.

## Formatting and linting

- **Prettier** (`.prettierrc`): single quotes, trailing commas everywhere (`"trailingComma": "all"`). Run via `pnpm run format`.
- **ESLint** (`eslint.config.mjs`): flat config, `typescript-eslint` `recommendedTypeChecked` + `eslint-plugin-prettier/recommended`. Notable rule overrides:
  - `@typescript-eslint/no-explicit-any`: off — `any` is permitted where needed.
  - `@typescript-eslint/no-floating-promises`: warn (not error).
  - `@typescript-eslint/no-unsafe-argument`: warn.
  - `@typescript-eslint/unbound-method`: off in `*.spec.ts` files only (Jest's `expect(repo.method).toHaveBeenCalledWith(...)` otherwise trips this rule).
  - `prettier/prettier` errors with `endOfLine: "auto"`.
- Run `pnpm run lint` (auto-fixes) before considering work done.

## TypeScript/NestJS patterns

### Module layering (per domain)

Follow `domain/ → application/ → infrastructure/ → presentation/` (see `docs/architecture.md` for the full description). Concretely:

- **Never** import the generated Prisma client (`generated/prisma`) outside a module's `infrastructure/` folder.
- **Never** call `CommandBus`/`QueryBus`-mediated business logic directly from a repository — orchestration belongs in `application/` handlers.
- Domain entities are immutable-by-convention: a `private constructor`, a `static create(props)` factory that validates invariants, a `static fromPersistence(props)` factory for rehydration, and mutation methods (`update()`, `changeStatus()`, `pay()`, `cancel()`) that return a **new** instance rather than mutating `this`. Example: `src/modules/catalog/domain/entities/product.entity.ts`, `src/modules/orders/domain/entities/order.entity.ts`.
- Repository/port interfaces live in `domain/repositories/` or `domain/ports/`, each with a paired DI token constant (e.g. `export const PRODUCT_REPOSITORY = Symbol(...)` or a string token) used with `@Inject(TOKEN)` in handlers and bound to a concrete class in the module's `providers` array.

### CQRS

- One file per command/query (`*.command.ts` / `*.query.ts`) and one file per handler (`*.handler.ts`), colocated in a folder per use case: `application/commands/<use-case>/` or `application/queries/<use-case>/`.
- Handlers are decorated `@CommandHandler(XCommand)` / `@QueryHandler(XQuery)` and implement `ICommandHandler<X, ReturnType>` / `IQueryHandler<X, ReturnType>`.
- Controllers only depend on `CommandBus`/`QueryBus` — they build a command/query from the DTO and `await bus.execute(...)`, then map the result to a response DTO.
- Domain events (`application/events/*.event.ts`, e.g. `UserRegisteredEvent`) are raised for cross-module side effects (currently only in Users, consumed by Realtime's `@EventsHandler`s) rather than modules directly depending on each other for notification concerns.

### Cross-module access

When a module needs another module's data, define a narrow port interface (`domain/ports/` or `domain/repositories/*.port.ts`) with only the methods actually needed (e.g. `ProductLookupPort.exists(productId)`), and implement it in `infrastructure/adapters/` against the other module's own repository or Prisma directly. Do not import another module's `Prisma*Repository` or reach into its `application/` layer.

### Error handling

- **Domain-layer invariant violations** throw `DomainError` (`src/shared/domain/domain-error.ts`) — a plain `Error` subclass, framework-agnostic. It's caught globally by `DomainErrorFilter` and turned into HTTP 400. Use this for business-rule violations (e.g. "Product must have at least one category", "Order item quantity must be positive").
- **"Not found" / not-your-resource** cases in application handlers throw NestJS's own `NotFoundException` directly (not `DomainError`) — see `PlaceOrderHandler`, `CreateCommentHandler`. Convention: scoping-by-owner queries (e.g. fetching another user's order) return 404, not 403, to avoid confirming the resource exists.
- **Prisma errors** are not caught ad hoc in repositories — they propagate up to the global `PrismaExceptionFilter`, which maps `P2002`/`P2003`/`P2025` to 409/400/404 and anything else to 500. Don't wrap Prisma calls in module-level try/catch just to translate error codes; that's centralized already.
- External-service adapters (e.g. `HttpCommentModerationAdapter`) should **throw, not swallow**, on failure — let a wrapping adapter (like `FallbackCommentModerationAdapter`) decide the degraded behavior explicitly, rather than the low-level adapter silently guessing a default.

### DTO / validation patterns

- Request DTOs live in `presentation/dto/` and use `class-validator` decorators; the global `ValidationPipe({ whitelist: true, transform: true })` (set in `main.ts`) strips unknown properties and coerces types.
- Common validators seen throughout: `@IsString()`, `@IsInt()`, `@Min(0)`, `@IsOptional()`, `@IsUUID('4', { each: true })` for arrays of ids, `@ArrayMinSize()`, `@ArrayUnique()`, `@IsUrl({ require_tld: false })` for local/dev-friendly URLs, `@Matches(/regex/, customMessage)` for non-blank/slug-shaped strings, `@ValidateNested({ each: true })` + `@Type(() => NestedDto)` for nested object arrays (e.g. `CreateProductDto.variants`).
- A shared "not blank" message helper pattern: `const NOT_BLANK = { message: (args) => \`${args.property} must not be blank\` }` passed as the second arg to `@Matches`, so empty/whitespace-only strings fail with a useful message (`class-validator`'s `@IsString()` alone allows empty strings).
- Response DTOs are plain classes with a `static fromDomain(entity)` (or `fromResult`/`fromDetail`/`fromListItem`) factory that maps a domain entity to a plain response shape — controllers always return `ResponseDto.fromDomain(...)`, never the raw domain entity or a raw Prisma record.
- Paginated endpoints return `{ items, total, page, pageSize }`; list query DTOs accept `page`/`pageSize` (and clamp them again at the query-handler level, not just the DTO, per `CLAUDE.md`).

### Naming conventions

- Files: `kebab-case.ts`, suffixed by role — `*.entity.ts`, `*.repository.ts`, `*.command.ts`, `*.handler.ts`, `*.query.ts`, `*.dto.ts`, `*.controller.ts`, `*.module.ts`, `*.guard.ts`, `*.adapter.ts`, `*.port.ts`, `*.filter.ts`, `*.middleware.ts`.
- Classes: `PascalCase` matching the file's role suffix (`CreateProductCommand`, `CreateProductHandler`, `ProductResponseDto`, `PrismaProductRepository`).
- DI tokens for interfaces: `SCREAMING_SNAKE_CASE` constants exported alongside the interface, e.g. `PRODUCT_REPOSITORY`, `COMMENT_MODERATION_PORT`, `PRODUCT_CATALOG_PORT`.
- REST routes: plural, kebab-free resource nouns under a domain prefix (`/catalog/products`, `/orders`, `/admin/users`, `/catalog/products/:productId/comments`), with admin-only variants under `/admin/<domain>`.

### Comments in code

The codebase makes heavy use of short comments that explain **why**, not what — e.g. "deliberately does not touch variants... regenerating variant ids on every detail edit would silently invalidate anything already in a customer's cart." Follow this style for any non-obvious business or architectural decision; skip comments that just restate the code.

## Testing conventions

- **Unit tests**: `*.spec.ts` colocated next to the file under test (e.g. `product.entity.spec.ts`, `create-product.handler.spec.ts`). Run with `pnpm run test`; no Docker/DB needed — all repositories/ports are mocked using in-memory fakes under each module's `testing/` folder (e.g. `src/modules/catalog/testing/mock-product-repository.ts`).
- **e2e tests**: under `test/*.e2e-spec.ts`, one file roughly per domain (`catalog.e2e-spec.ts`, `orders.e2e-spec.ts`, `comments.e2e-spec.ts`, `admin-users.e2e-spec.ts`, `auth.e2e-spec.ts`, `app.e2e-spec.ts`). Run with `pnpm run test:e2e`, which requires Docker's Postgres to be up (`docker compose up -d`) and sets `NODE_OPTIONS=--experimental-vm-modules` (needed because Prisma 7's WASM query compiler uses a dynamic `import()` that Jest otherwise rejects).
- e2e tests exercise the full guard/permission matrix for admin routes (see `admin-users.e2e-spec.ts`'s STAFF-with-permission-still-blocked-from-role-change case) and cross-user 404 behavior, not just happy paths.
- Before considering any change done: run `pnpm test && pnpm test:e2e` (with Docker up).

## Commit / PR conventions

No commit message convention, PR template, or CI workflow file was found in this repo (no `.github/` directory, no `CONTRIBUTING.md`). `CLAUDE.md` itself is updated as a running development log (its "Current Progress" section, dated) — when making a substantial change, consider whether that log should be updated too, per the file's own instructions ("Update this section as work continues").
