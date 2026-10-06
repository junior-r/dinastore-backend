# Users

Authentication (password + Google OAuth), JWT issuance, and role/permission-based authorization, including admin user management. The most security-sensitive module in the codebase.

Source: `src/modules/users/`

## Entity

`User` (`domain/entities/user.entity.ts`) — email, optional `passwordHash` (null for OAuth-only accounts), `name`, optional `avatarUrl` (populated only from an OAuth provider's profile photo — no upload/edit path exists for password-only accounts), `role` (`CUSTOMER` / `STAFF` / `ADMIN`), `isActive`, `permissions: string[]` (see `Permission` enum below).

## Permissions

`Permission` (`domain/entities/permission.ts`) is a **fixed, known enum**, not admin-defined/dynamic:

```
USERS_VIEW, USERS_MANAGE,
PRODUCTS_VIEW, PRODUCTS_MANAGE,
CATEGORIES_VIEW, CATEGORIES_MANAGE
```

`STAFF` users are granted a subset of these; `ADMIN` bypasses permission checks entirely regardless of grants.

## Endpoints

**Auth** (`AuthController`, `/auth`):
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (JWT-guarded).

**OAuth** (`OAuthController`, `/auth`):
- `GET /auth/google` (redirects to Google's consent screen), `GET /auth/google/callback` (links or creates the user, redirects to `{FRONTEND_URL}/auth/callback?token=<jwt>`).

**Admin** (`AdminUsersController`, `/admin/users`, all guarded `ADMIN`/`STAFF`):
- `GET /` (`users:view`), `GET /:id` (`users:view`, returns `oauthAccounts` + `hasPassword`)
- `PATCH /:id/role`, `PATCH /:id/permissions` — **ADMIN-only** (overrides the class-level `@Roles`) even for a STAFF user holding `users:manage`, specifically so STAFF can't self-escalate.
- `PATCH /:id/deactivate`, `PATCH /:id/activate` (`users:manage`)
- Self-modification (own role, own permissions, own deactivation) is blocked at the command-handler level with `DomainError` (400) to prevent an admin locking themselves out.

## Auth mechanics

- **Password hashing**: Node's built-in `crypto.scrypt` (`ScryptPasswordHasher`), chosen over bcrypt/argon2 specifically to avoid native-module compilation on Windows.
- **JWT**: `JwtStrategy` is stateless — validates signature/expiry only, no DB round-trip per request. A role change only takes effect after the user's token is refreshed (re-login), since `RolesGuard` reads the `role` claim straight off the JWT.
- **`PermissionsGuard`** bypasses entirely for `ADMIN`; for `STAFF` it does a fresh `UserRepository.findById` lookup on every request, checking `isActive` and `permissions` — so deactivation/permission changes take effect immediately on admin routes even with an already-issued token, unlike the rest of the app.
- **OAuth**: `OAuthAccount` (`provider` + `providerAccountId`, unique together) links to `User`. `OAuthLoginHandler` tries, in order: sign in if the provider account is already linked → link the provider to an existing user found by email → create a new `CUSTOMER` user. Only Google has a real Passport strategy wired in today (`GoogleStrategy`); the `OAuthProvider` enum has all four members (Google/GitHub/Spotify/Apple) and `CLAUDE.md` documents the extension path for the others. `UserRepository.setAvatarUrlIfMissing` runs on every OAuth login so an account created before it had a photo picks one up as soon as it's available, without ever overwriting an existing avatar.
- Login (password and OAuth) is blocked when `isActive` is false, checked in both `LoginUserHandler` and `OAuthLoginHandler`.

## Domain events

`UserRegisteredEvent` and `UserDeactivatedEvent` (`application/events/`) are the only domain events raised in the codebase currently, published through the CQRS `EventBus`. They're consumed by the **Realtime** module's `@EventsHandler`s to push live notifications — Users has no direct dependency on Realtime.

## Interaction with other modules

- Every other module's guarded routes (`Catalog` admin routes, `Orders`, `Comments`) depend on Users' `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `CurrentUser` decorator, and `Role`/`Permission` enums.
- **Realtime** depends on Users for its `UserRepository` (to authenticate socket handshakes) and consumes its domain events.
