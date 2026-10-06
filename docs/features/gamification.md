# Gamification

Status: **module shell only** — no domain logic implemented yet.

Source: `src/modules/gamification/gamification.module.ts`

```ts
@Module({
  imports: [CqrsModule],
  controllers: [],
  providers: [],
})
export class GamificationModule {}
```

It is wired into `AppModule` but has no controllers, entities, repositories, or DTOs.

## Intended scope (per `CLAUDE.md`)

Manage quiz states, validate answers, and handle distribution of promotional codes and access to limited-edition drops. None of this exists in code yet.

## Likely integration points, once built

- **Users** — quiz progress and earned promo codes/drop access would presumably be scoped per user, following the same `@CurrentUser()`/`JwtAuthGuard` pattern used by Orders and Comments.
- **Catalog/Orders** — promo codes or drop-access gating would need to be checked somewhere in the order-placement path (`PlaceOrderHandler` in `orders/`), most likely via a new narrow port (mirroring `ProductCatalogPort`/`ProductLookupPort`) rather than a direct cross-module dependency.
- Following the established module layout, a real implementation should add `domain/`, `application/`, `infrastructure/`, `presentation/`, and `testing/` folders mirroring Catalog/Orders/Comments.
