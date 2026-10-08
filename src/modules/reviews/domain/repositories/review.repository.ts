import { Review } from '../entities/review.entity';
import type { RatingSummary } from '../rating-summary';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface ReviewAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

// A read-side projection (author joined in), distinct from the Review
// aggregate, for the same reason CommentListItem is: User isn't part of it.
export interface ReviewListItem {
  id: string;
  productId: string;
  rating: number;
  body: string | null;
  author: ReviewAuthor;
  createdAt: Date;
  updatedAt: Date;
}

export interface FindReviewsParams {
  productId: string;
  skip?: number;
  take?: number;
}

export interface ReviewRepository {
  /**
   * Inserts the review, or replaces the rating and comment of the one this
   * user already left on this product. There is never a second row.
   */
  save(review: Review): Promise<Review>;
  findByProductAndUser(
    productId: string,
    userId: string,
  ): Promise<Review | null>;
  /** Idempotent: deleting a review that isn't there is a no-op. */
  deleteByProductAndUser(productId: string, userId: string): Promise<void>;
  /**
   * Reviews that carry a comment, most recently edited first. A bare star
   * rating counts toward the summary but has nothing to show in a list.
   */
  findWrittenByProduct(params: FindReviewsParams): Promise<ReviewListItem[]>;
  countWrittenByProduct(productId: string): Promise<number>;
  summarize(productId: string): Promise<RatingSummary>;
}
