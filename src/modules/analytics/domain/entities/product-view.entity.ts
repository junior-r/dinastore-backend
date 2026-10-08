import { DomainError } from '@/shared/domain/domain-error';

// A single visit is capped here. Nobody studies one product for longer than
// this; a number past it means a tab left open, and it would drag every
// average up if it were stored as watching time.
export const MAX_VIEW_DURATION_MS = 4 * 60 * 60 * 1000;

export interface ProductViewProps {
  id: string;
  // Null once the product has been deleted from the catalog; `productName`
  // is what survives.
  productId: string | null;
  productName: string;
  userId: string | null;
  visitorId: string;
  ipAddress: string;
  country: string | null;
  durationMs: number;
  favorited: boolean;
  startedAt: Date;
  lastSeenAt: Date;
}

export interface StartProductViewInput {
  id: string;
  productId: string;
  productName: string;
  userId: string | null;
  visitorId: string;
  ipAddress: string;
  country: string | null;
  durationMs: number;
  favorited: boolean;
}

export interface ProductViewProgress {
  durationMs: number;
  favorited: boolean;
  userId: string | null;
}

function normalizeDuration(durationMs: number): number {
  if (!Number.isInteger(durationMs) || durationMs < 0) {
    throw new DomainError('View duration must be a non-negative integer');
  }
  return Math.min(durationMs, MAX_VIEW_DURATION_MS);
}

/**
 * One visit to a product page. Created when the page opens and topped up by
 * `progress()` while the visitor stays on it.
 */
export class ProductView {
  private constructor(private readonly props: ProductViewProps) {}

  static start(input: StartProductViewInput): ProductView {
    if (input.ipAddress.trim().length === 0) {
      throw new DomainError('A product view needs the visitor IP address');
    }
    const now = new Date();
    return new ProductView({
      ...input,
      durationMs: normalizeDuration(input.durationMs),
      startedAt: now,
      lastSeenAt: now,
    });
  }

  static fromPersistence(props: ProductViewProps): ProductView {
    return new ProductView(props);
  }

  /**
   * Applies a later report from the same visit. Returns a new instance.
   *
   * - The duration only ever grows. Reports are sent over the network and can
   *   arrive out of order (a slow heartbeat landing after the final one); an
   *   older, smaller number must not shrink what is already recorded.
   * - `favorited` is the latest reported state, so it can go either way.
   * - A visit that began anonymous picks up the user if they sign in during
   *   it, but never loses or swaps a user it already has.
   *
   * Who, where and which product are fixed at `start()` and are deliberately
   * not accepted here: a follow-up report can't relabel an existing row.
   */
  progress(update: ProductViewProgress): ProductView {
    return new ProductView({
      ...this.props,
      durationMs: Math.max(
        this.props.durationMs,
        normalizeDuration(update.durationMs),
      ),
      favorited: update.favorited,
      userId: this.props.userId ?? update.userId,
      lastSeenAt: new Date(),
    });
  }

  get id(): string {
    return this.props.id;
  }
  get productId(): string | null {
    return this.props.productId;
  }
  get productName(): string {
    return this.props.productName;
  }
  get userId(): string | null {
    return this.props.userId;
  }
  get visitorId(): string {
    return this.props.visitorId;
  }
  get ipAddress(): string {
    return this.props.ipAddress;
  }
  get country(): string | null {
    return this.props.country;
  }
  get durationMs(): number {
    return this.props.durationMs;
  }
  get favorited(): boolean {
    return this.props.favorited;
  }
  get startedAt(): Date {
    return this.props.startedAt;
  }
  get lastSeenAt(): Date {
    return this.props.lastSeenAt;
  }
}
