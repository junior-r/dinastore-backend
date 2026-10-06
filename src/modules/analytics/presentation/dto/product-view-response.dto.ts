import type { ProductViewListItem } from '@/modules/analytics/domain/repositories/product-view.repository';

export class ProductViewResponseDto {
  id!: string;
  // `id` and `slug` are null once the product has been deleted; `name` is the
  // snapshot taken when the visit happened and is always present.
  product!: { id: string | null; name: string; slug: string | null };
  /** Null for a visitor who was not signed in. */
  user!: { id: string; name: string; email: string } | null;
  visitorId!: string;
  ipAddress!: string;
  /** ISO 3166-1 alpha-2, or null when the address couldn't be placed. */
  country!: string | null;
  durationMs!: number;
  favorited!: boolean;
  startedAt!: Date;
  lastSeenAt!: Date;

  static fromListItem(item: ProductViewListItem): ProductViewResponseDto {
    const { view } = item;
    const dto = new ProductViewResponseDto();
    dto.id = view.id;
    dto.product = {
      id: view.productId,
      name: view.productName,
      slug: item.productSlug,
    };
    dto.user = item.user;
    dto.visitorId = view.visitorId;
    dto.ipAddress = view.ipAddress;
    dto.country = view.country;
    dto.durationMs = view.durationMs;
    dto.favorited = view.favorited;
    dto.startedAt = view.startedAt;
    dto.lastSeenAt = view.lastSeenAt;
    return dto;
  }
}
