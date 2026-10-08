# DinaStore Backend

API and services layer for the DinaStore e-commerce / print-on-demand platform. NestJS, DDD + CQRS, Prisma/PostgreSQL, Redis, JWT auth.

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local PostgreSQL + Redis)

## Setup

```bash
cp .env.example .env      # then edit JWT_SECRET etc. if needed
docker compose up -d      # starts Postgres + Redis
pnpm install
pnpm exec prisma migrate dev   # creates the schema and generates the Prisma client
```

`docker compose up -d` must stay running (or be started again) any time you run the app, its tests, or Prisma commands — everything talks to that Postgres/Redis instance. Check its status with `docker ps`.

## Running the app

```bash
pnpm run start:dev    # watch mode, http://localhost:3000
pnpm run start        # no watch
pnpm run build        # compiles to dist/
pnpm run start:prod   # runs the compiled build (dist/main.js)
```

## Testing

```bash
pnpm run test         # unit tests (Jest) — no Docker required, all I/O is mocked
pnpm run test:e2e     # e2e tests — requires Docker (Postgres) to be running
pnpm run test:cov     # unit tests with coverage
```

## Other useful commands

```bash
pnpm run lint                         # eslint --fix
pnpm run format                       # prettier --write
pnpm exec prisma studio               # browse the database
pnpm exec prisma migrate dev --name X # create a new migration after editing prisma/schema.prisma
```

## Environment variables

See `.env.example` for the full list. Notable ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string (matches `docker-compose.yml` by default) |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Signing secret for auth tokens — change this for any non-local environment |
| `JWT_EXPIRES_IN_SECONDS` | Access token lifetime, in seconds |
| `FRONTEND_URL` | Allowed CORS origin (the frontend dev server, `http://localhost:4321` by default) |
| `PORT` | HTTP port the API listens on (defaults to `3000`) |

## Architecture

Each business domain under `src/modules/` follows the same DDD/CQRS layering:

```
modules/<domain>/
├── domain/            # entities, repository interfaces, domain services — no framework/Prisma imports
├── application/       # CQRS commands + queries + handlers, orchestrating the domain layer
├── infrastructure/    # Prisma repository implementations, external service adapters
└── presentation/      # controllers, DTOs
```

Shared cross-cutting infrastructure (Prisma client/module, global exception filters, the `DomainError` base class) lives under `src/shared/`.

Implemented so far: **Catalog** (products, categories, variants) and **Users** (registration, JWT login, `/auth/me`).
