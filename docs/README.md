# DinaStore Backend Documentation

Developer-onboarding documentation for the DinaStore backend (NestJS + Prisma/PostgreSQL). This is a companion to, not a replacement for, `../CLAUDE.md` (the running architecture/progress log — check it for the latest state) and `../README.md` (setup and run instructions).

## Contents

- [`architecture.md`](./architecture.md) — framework, module layering (domain/application/infrastructure/presentation), cross-cutting concerns (auth, real-time, database access, error handling), request lifecycle, and key architectural decisions.
- [`code-standards.md`](./code-standards.md) — TypeScript/NestJS conventions actually used in this repo: linting/formatting, CQRS and DTO patterns, error-handling conventions, naming conventions, and testing conventions.
- [`features/`](./features) — one file per feature module:
  - [`catalog.md`](./features/catalog.md) — products, categories, variants, images
  - [`orders.md`](./features/orders.md) — placing/paying orders, stock decrement
  - [`comments.md`](./features/comments.md) — product comments and moderation
  - [`users.md`](./features/users.md) — auth, JWT, OAuth, roles/permissions, admin user management
  - [`realtime.md`](./features/realtime.md) — Socket.io gateway bridging domain events to clients
  - [`analytics.md`](./features/analytics.md) — product-view history: time watched, IP, country, favorites
  - [`customizations.md`](./features/customizations.md) — design studio: artwork upload, logo stamping, print files, designs on order items
  - [`gamification.md`](./features/gamification.md) — module shell, not yet implemented
  - [`ai-agent.md`](./features/ai-agent.md) — module shell, not yet implemented

## Where to start

- New to the codebase: read `architecture.md` first, then `features/catalog.md` (the reference implementation for the module pattern).
- Writing new code: read `code-standards.md` before adding a module or handler.
- Working on a specific domain: jump straight to its file under `features/`.
