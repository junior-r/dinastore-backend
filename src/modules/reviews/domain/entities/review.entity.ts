import { DomainError } from '@/shared/domain/domain-error';

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_REVIEW_BODY_LENGTH = 1000;

export interface ReviewProps {
  id: string;
  productId: string;
  userId: string;
  /** Whole stars, MIN_RATING..MAX_RATING. */
  rating: number;
  /** Null when the rating was left without a comment. */
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewContent {
  rating: number;
  body?: string | null;
}

/**
 * One shopper's star rating of one product, optionally with a comment. The
 * stars are the required part; the text is not.
 */
export class Review {
  private constructor(private readonly props: ReviewProps) {}

  static create(
    props: { productId: string; userId: string } & ReviewContent,
  ): Review {
    const now = new Date();
    return new Review({
      id: crypto.randomUUID(),
      productId: props.productId,
      userId: props.userId,
      rating: validateRating(props.rating),
      body: normalizeBody(props.body),
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: ReviewProps): Review {
    return new Review(props);
  }

  /**
   * Rating again replaces the earlier rating, comment included: leaving the
   * comment out removes one that was there before. Who rated and what they
   * rated never change.
   */
  revise(content: ReviewContent): Review {
    return new Review({
      ...this.props,
      rating: validateRating(content.rating),
      body: normalizeBody(content.body),
      updatedAt: new Date(),
    });
  }

  get id(): string {
    return this.props.id;
  }

  get productId(): string {
    return this.props.productId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get rating(): number {
    return this.props.rating;
  }

  get body(): string | null {
    return this.props.body;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toPersistenceProps(): ReviewProps {
    return this.props;
  }
}

function validateRating(rating: number): number {
  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    throw new DomainError(
      `Rating must be a whole number from ${MIN_RATING} to ${MAX_RATING}`,
    );
  }
  return rating;
}

// A blank comment is the same thing as no comment, so it is stored as null
// rather than as an empty string the read side would have to special-case.
function normalizeBody(raw: string | null | undefined): string | null {
  const body = raw?.trim();
  if (!body) {
    return null;
  }
  if (body.length > MAX_REVIEW_BODY_LENGTH) {
    throw new DomainError(
      `Review comment cannot exceed ${MAX_REVIEW_BODY_LENGTH} characters`,
    );
  }
  return body;
}
