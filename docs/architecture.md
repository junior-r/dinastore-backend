# Architecture

## Overview

DinaStore's backend is a NestJS API for an e-commerce / print-on-demand platform for a custom clothing brand: product catalog, orders, comments, real-time notifications, and stubs for design customization, gamification, and an AI design assistant.

- **Framework:** NestJS 11, strict TypeScript, Node.js 22+
- **Database:** PostgreSQL via Prisma ORM 7 (`@prisma/adapter-pg` driver adapter — Prisma 7 has no built-in query engine binary, so a driver adapter is mandatory)
- **Caching/messaging:** Redis (`ioredis`), provisioned via `docker-compose.yml` alongside Postgres
- **Real-time:** Socket.io via `@nestjs/websockets` + `@nestjs/platform-socket.io`
- **Auth:** JWT (`@nestjs/jwt`, `passport-jwt`) + Google OAuth (`passport-google-oauth20`)
- **Validation:** `class-validator` / `class-transformer` DTOs, wired through a global `ValidationPipe`

This document summarizes the architecture as implemented today. `../CLAUDE.md` is the canonical, continuously-updated source of truth (including a dated "Current Progress" log); this file restructures it into a stable reference rather than replacing it.

## Layering: DDD-ish + CQRS per module

Every business domain lives under `src/modules/<domain>/` and follows the same four-folder layering (see `README.md`):

```
modules/<domain>/
├── domain/            # entities, repository interfaces, domain services — no framework/Prisma imports
├── application/       # CQRS commands + queries + handlers, orchestrating the domain layer
├── infrastructure/    # Prisma repository implementations, external service adapters
├── presentation/      # controllers, DTOs
└── testing/           # in-memory mock repositories/ports shared by unit tests
```

- **`domain/`** holds framework-agnostic business rules: entities built with a private constructor + static factory (`Product.create(...)`, `Order.create(...)`), invariants enforced by throwing `DomainError` (not a NestJS `HttpException` — keeps the domain layer decoupled from HTTP), and repository/port *interfaces* plus their DI tokens (e.g. `PRODUCT_REPOSITORY`).
- **`application/`** implements the interface with NestJS CQRS (`@nestjs/cqrs`): one `*Command`/`*Query` class plus one `*Handler` (`@CommandHandler`/`@QueryHandler`) per use case, each in its own folder. Handlers orchestrate domain entities and repositories/ports — they contain no Prisma calls directly.
- **`infrastructure/`** implements the domain's repository/port interfaces against Prisma (`Prisma*Repository`) or external HTTP services (e.g. the comments moderation adapters), and holds framework glue like Passport strategies and guards.
- **`presentation/`** exposes NestJS `@Controller()`s and request/response DTOs. Controllers only depend on `CommandBus`/`QueryBus` — they never call a repository or Prisma directly.

This is a **repository-pattern / ports-and-adapters style**, not literal hexagonal architecture with a full application-service layer — CQRS command/query handlers double as the application layer. The intent (per `CLAUDE.md`) is "business logic decoupled from HTTP controllers and database adapters," achieved via the domain/application/infrastructure split rather than a stricter DDD ceremony (no aggregate roots beyond the entity itself, no domain events on most entities — Users is the one module that raises `UserRegisteredEvent`/`UserDeactivatedEvent` through the CQRS `EventBus`).

### Cross-module dependencies: narrow ports, not shared repositories

When one module needs data owned by another, it defines its own narrow **port** interface in its own `domain/` folder rather than importing the other module's repository directly:

- Orders depends on `ProductCatalogPort` (`modules/orders/domain/repositories/product-catalog.port.ts`) — implemented by `PrismaProductCatalogAdapter` — to price/validate line items, instead of depending on Catalog's `ProductRepository`.
- Comments depends on `ProductLookupPort` (`exists(productId)` only) for the same reason.

This keeps each module's read/write surface onto another domain minimal and explicit. Comments is the smallest example of this pattern end-to-end.

## Module inventory

| Module | Status |
| --- | --- |
| `catalog` | Full DDD/CQRS vertical slice — products, categories, variants, images, admin CRUD |
| `users` | Full vertical slice — registration, JWT login, Google OAuth, roles/permissions, admin user management |
| `orders` | Full vertical slice — place/pay orders, atomic stock decrement |
| `comments` | Full vertical slice — product comments with pluggable moderation |
| `realtime` | Real logic (not a shell): a Socket.io gateway bridging Users' domain events to connected clients |
| `customizations` | Module shell only — `@Module({ imports: [CqrsModule], controllers: [], providers: [] })`, no domain code yet |
| `gamification` | Module shell only, same as above |
| `ai-agent` | Module shell only, same as above |

See `docs/features/` for one file per module. Note that `CLAUDE.md`'s "Not yet built" list (dated 2026-08-09) says Customizations/Gamification/Realtime/AI Agent are "module shells only" — that is still true for the latter three, but Realtime now has a working `RealtimeGateway` and event listeners (see `docs/features/realtime.md`); treat the code as the source of truth over that log entry's exact wording.

## Cross-cutting concerns

### Database access (Prisma)

- `PrismaService` (`src/shared/infrastructure/prisma/prisma.service.ts`) extends the generated `PrismaClient`, constructed with a `PrismaPg` driver adapter over `DATABASE_URL`, and hooks `$connect`/`$disconnect` into Nest's `OnModuleInit`/`OnModuleDestroy` lifecycle. `PrismaModule` exports it globally.
- The Prisma client is generated to `generated/prisma` (not `node_modules`), with `moduleFormat = "cjs"` pinned in `prisma/schema.prisma` (Prisma's ESM-only default output breaks this CJS project).
- Every module's `infrastructure/repositories/Prisma*Repository` is the only place that imports the generated Prisma client directly.

### Error handling

Two global exception filters are registered via `APP_FILTER` in `AppModule` (so they apply under `pnpm test:e2e` too, not only when `main.ts` boots):

- `DomainErrorFilter` — catches `DomainError` (thrown by domain entities/handlers for invariant violations) and maps it to HTTP 400.
- `PrismaExceptionFilter` — catches `Prisma.PrismaClientKnownRequestError` and maps known codes: `P2002` (unique constraint) → 409, `P2003` (FK violation) → 400, `P2025` (record not found) → 404, anything else → 500.

A convention used throughout: operations scoped to "my own resource" (e.g. `GET /orders/:id`, deleting a comment) return **404, not 403**, when the resource belongs to someone else — this avoids leaking whether the resource exists at all.

### Auth

- **JWT** — `JwtStrategy` (Passport) is deliberately **stateless**: it validates the token's signature/expiry only, with no DB round-trip per request. `JwtAuthGuard` wraps it for `@UseGuards()`.
- **Google OAuth** — `GoogleStrategy` + `OAuthController` (`GET /auth/google`, `GET /auth/google/callback`); a successful login redirects to `{FRONTEND_URL}/auth/callback?token=<jwt>`. `OAuthLoginHandler` links-or-creates a `User` from the provider profile. The `OAuthProvider` enum has four members (Google/GitHub/Spotify/Apple) but only Google has a real Passport strategy wired in; adding another is documented as a small, mechanical extension in `CLAUDE.md`.
- **Roles vs. permissions** — two separate guards, composed together:
  - `RolesGuard` checks the `role` claim (`CUSTOMER`/`STAFF`/`ADMIN`) straight off the JWT payload — no DB call, so a role change only takes effect after re-login.
  - `PermissionsGuard` bypasses entirely for `ADMIN`; for `STAFF` it does a fresh `UserRepository.findById` lookup **on every request**, checking `isActive` and `permissions` — so deactivating a STAFF user or changing their grants takes effect immediately even on an already-issued token, unlike the rest of the app.
  - Applied together as `@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)` with `@Roles(...)` / `@RequirePermission(...)` decorators on admin routes.
- Password hashing uses Node's built-in `crypto.scrypt` (`ScryptPasswordHasher`) rather than bcrypt/argon2, specifically to avoid native-module compilation on Windows dev machines.

### File storage

Uploaded files go through the `FileStorage` port (`src/shared/domain/storage/file-storage.port.ts` — `put`, `delete`, `publicUrl`), injected as `FILE_STORAGE` from the global `StorageModule`. Consumers persist **keys**, not URLs, and resolve URLs at read time, so the backend can change without touching stored data.

- `STORAGE_DRIVER` selects the adapter. Only `local` exists (`LocalDiskFileStorage`: writes under `STORAGE_LOCAL_DIR`, default `uploads/`, served by `main.ts` at `/uploads` with a one-year immutable `Cache-Control`). `STORAGE_PUBLIC_URL` overrides the public base URL (CDN / reverse proxy).
- Adding a backend = a class implementing `FileStorage` + a `case` in `storage.module.ts`.
- Currently used by comment images only; product images predate it and still use multer's disk storage directly.

### Real-time (WebSockets)

`RealtimeGateway` (`src/modules/realtime/realtime.gateway.ts`) is a Socket.io gateway on namespace `/realtime`. On connection it verifies the JWT passed via `handshake.auth.token` (or an `Authorization: Bearer` header), loads the user, and joins them to a per-user room (`user:<id>`) plus an `admins:users` room if they can view the user list. `UserRegisteredListener`/`UserDeactivatedListener` (`user-events.listener.ts`) subscribe to Users' CQRS domain events (`UserRegisteredEvent`, `UserDeactivatedEvent`) via `@EventsHandler` and push them out through the gateway — this is how Users module changes reach connected clients without Users depending on Realtime directly (Realtime depends on Users, not the reverse).

### AI agent integration

`ai-agent` is currently an empty module shell (`CqrsModule` import only, no controllers/providers). Per `CLAUDE.md`, the intent is a proxy/bridge between the frontend and a local AI instance (e.g. Ollama running Qwen) for design-prompt assistance — no such integration exists in code yet.

### External services

Comments moderation calls a **sibling standalone service**, `feelings-analysis` (Python/FastAPI, outside this repo, at `../feelings-analysis`), which scores comment text with a self-hosted Detoxify toxicity classifier. See `docs/features/comments.md` for the adapter chain (`Http` → `Fallback` → `Keyword`).

## Request lifecycle

1. `main.ts` bootstraps a `NestExpressApplication`, applies a global `ValidationPipe({ whitelist: true, transform: true })`, enables CORS for `FRONTEND_URL`, serves `uploads/` as static assets under `/uploads/`, and attaches the Socket.io `IoAdapter`.
2. `RequestLoggerMiddleware` (`src/shared/infrastructure/middleware/request-logger.middleware.ts`) is applied to all routes in `AppModule.configure()` and logs `METHOD path status durationMs` on response finish — filling a gap Nest's own `Logger` doesn't cover by default.
3. Guards (`JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`) run per-route as declared.
4. DTOs validate/transform the request body/query via `class-validator`/`class-transformer`.
5. Controllers dispatch a CQRS command or query via `CommandBus`/`QueryBus`.
6. Handlers orchestrate domain entities + repositories/ports, throwing `DomainError` or NestJS `HttpException`s (e.g. `NotFoundException`) as needed.
7. Repositories translate to/from Prisma; the two global exception filters normalize domain/Prisma errors into HTTP responses.
8. Controllers map the returned domain entity to a response DTO (`*ResponseDto.fromDomain(...)`) before returning.

## Notable architectural decisions (from CLAUDE.md)

- **Product ↔ Category is many-to-many** (an implicit Prisma m2m), not a single required FK — a product can carry several category tags.
- **`OrderItem` snapshots** product/variant data (`productName`, `variantSize`, `variantColor`, `unitPriceCents`) instead of holding a FK to `ProductVariant`, so an order stays intact if the variant is later edited/deleted.
- **Stock decrement is atomic** with order creation via `prisma.$transaction`, using a conditional `updateMany` (`stock: { gte: quantity }`) per line item so concurrent checkouts can't oversell (`InsufficientStockError`, a `DomainError` subclass).
- **Admin product edits deliberately never touch variants** — regenerating variant ids on a detail edit would silently invalidate items already in customers' carts (carts are keyed by `productVariantId`).
- **No payment gateway is wired up** — `POST /orders/:id/pay` is a stub that flips `PENDING` → `PAID` immediately.
- Slugs: categories auto-generate their slug from `name` (NFKD-normalized, diacritics stripped, collision-resolved with `-2`, `-3`, ...); products still take a client-supplied slug.

## Tooling

- **Package manager:** pnpm (`pnpm-workspace.yaml` present — this backend is one workspace package)
- **Build:** `nest build` (Nest CLI, `nest-cli.json`)
- **Tests:** Jest — unit tests colocated as `*.spec.ts` (all I/O mocked, no Docker needed) and e2e tests under `test/*.e2e-spec.ts` (real Postgres via `docker-compose.yml`)
- **Lint/format:** ESLint flat config (`eslint.config.mjs`) + Prettier (`.prettierrc`) — see `docs/code-standards.md`
