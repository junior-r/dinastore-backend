# Orders

Handles placing and paying for orders, with an atomic, race-safe stock decrement at checkout.

Source: `src/modules/orders/`

## Entity

`Order` (`domain/entities/order.entity.ts`): invariants — at least one item, positive quantity, non-negative `unitPriceCents` per item. State transitions `pay()` and `cancel()` are only legal from `PENDING` (throw `DomainError` otherwise). `subtotalCents()` is computed from items, not stored redundantly on the entity (though the Prisma model does persist `subtotalCents`).

**`OrderItem` deliberately has no FK to `ProductVariant`** — it snapshots `productName`/`variantSize`/`variantColor`/`unitPriceCents` at order time, so an order stays intact even if the variant is later edited or deleted from the catalog.

## Endpoints

All under `OrdersController` (`/orders`), JWT-guarded and scoped to the requesting user:

- `POST /orders` — place an order.
- `GET /orders` — paginated list of the current user's orders.
- `GET /orders/:id` — a single order; **404 (not 403)** if it belongs to someone else, to avoid leaking existence.
- `POST /orders/:id/pay` — pays the order.

No order-cancellation endpoint exists yet — `Order.cancel()` is implemented on the domain entity but nothing calls it.

## CQRS

- `PlaceOrderCommand` / `PlaceOrderHandler` — merges duplicate variant ids in the request into a single line item (summing quantities), looks up all requested variants via `ProductCatalogPort.findVariantsByIds`, rejects unpublished products (`DomainError`) and mismatched currencies across items (`DomainError`), 404s on an unknown variant id.
- `PayOrderCommand` — a stub: flips `PENDING` → `PAID` immediately. **No real payment gateway** (no Stripe/MercadoPago keys configured) — swapping one in later is scoped to only touch `PayOrderHandler`.
- `GetMyOrdersQuery` (paginated), `GetOrderByIdQuery`.

## Notable business logic

- **`ProductCatalogPort`** (`domain/repositories/product-catalog.port.ts`) is a narrow read-only port into Catalog — Orders only pulls the slice of catalog data it needs (variant id, product id/name, size, color, unit price, currency, published flag), implemented by `PrismaProductCatalogAdapter`. Orders never depends on Catalog's own `ProductRepository`.
- **Atomic stock decrement**: `PrismaOrderRepository.create` wraps order creation and stock decrement in a single `prisma.$transaction`. Each line item issues a conditional `updateMany` (`stock: { gte: quantity }`); if the row doesn't match (insufficient stock), it throws `InsufficientStockError` (a `DomainError` subclass → 400). This prevents overselling under concurrent checkouts without a separate locking step.
- Cross-user access to `GET /orders/:id` and `POST /orders/:id/pay` returns 404, matching the codebase's existence-hiding convention.
- There is no admin view across all users' orders yet — Orders hasn't been wired up to `RolesGuard`/`PermissionsGuard` the way Users/Catalog have; it's "my orders" only.

## Interaction with other modules

- Depends on **Catalog** via `ProductCatalogPort` (pricing/publish-status/variant lookups).
- Depends on **Users** for `JwtAuthGuard`/`CurrentUser` (the authenticated user id, `currentUser.sub`, scopes every query/command).
