# Realtime

A Socket.io gateway that pushes live notifications to connected clients, bridging the CQRS domain-event bus to WebSocket rooms. Unlike Customizations/Gamification/AI Agent, this module is **not** an empty shell — it has working connection auth and two live notification paths.

Source: `src/modules/realtime/`

## Components

- **`RealtimeGateway`** (`realtime.gateway.ts`) — `@WebSocketGateway({ cors: { origin: FRONTEND_URL }, namespace: '/realtime' })`, implements `OnGatewayConnection`/`OnGatewayDisconnect`.
- **`user-events.listener.ts`** — `UserRegisteredListener` and `UserDeactivatedListener`, both `@EventsHandler`s subscribing to Users' CQRS domain events.
- **`RealtimeModule`** imports `CqrsModule` and `UsersModule`, provides the gateway and both listeners.

## Connection handshake

On `handleConnection`, the gateway:
1. Extracts a JWT from `handshake.auth.token`, falling back to an `Authorization: Bearer` header.
2. Verifies it (`JwtService.verifyAsync`) and loads the user via `UserRepository.findById`.
3. Disconnects immediately if the token is invalid/expired, the user doesn't exist, or `isActive` is false.
4. Joins the socket to a per-user room (`user:<id>`).
5. Also joins an `admins:users` room if the user can view the admin user list (`role === ADMIN` or has `Permission.USERS_VIEW`).

`handleDisconnect` is a no-op — no per-connection state is tracked outside socket.io's own room membership.

## Events emitted

- **`user.deactivated`** — sent to the deactivated user's own room (`notifyUserDeactivated`), with a message and `supportUrl`. Triggered by `UserDeactivatedListener` reacting to `UserDeactivatedEvent`.
- **`user.registered`** — broadcast to the `admins:users` room (`notifyUserRegistered`) with the new user serialized via `UserResponseDto`. Triggered by `UserRegisteredListener` reacting to `UserRegisteredEvent`.

## Design notes

- This module depends on **Users** (`UsersModule`, `UserRepository`, domain events) — the dependency runs one way; Users has no knowledge of Realtime. This is the same "bridge module" pattern used to keep Users decoupled from delivery mechanisms.
- Per `CLAUDE.md`, the intended scope of Real-Time Communications is broader — "live order tracking updates and the real-time customer support chat" — neither of which exists yet; only the Users-event bridge described above is implemented.
- `main.ts` wires the Socket.io transport via `app.useWebSocketAdapter(new IoAdapter(app))`.

## Interaction with other modules

- Consumes **Users** domain events and repository.
- No other module currently emits events consumed here (Orders/Catalog/Comments do not yet publish domain events for order-tracking or chat use cases).
