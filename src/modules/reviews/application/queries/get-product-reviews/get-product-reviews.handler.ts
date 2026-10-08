import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { Review } from '@/modules/reviews/domain/entities/review.entity';
import type { RatingSummary } from '@/modules/reviews/domain/rating-summary';
import { REVIEW_REPOSITORY } from '@/modules/reviews/domain/repositories/review.repository';
import type {
  ReviewListItem,
  ReviewRepository,
} from '@/modules/reviews/domain/repositories/review.repository';
import { GetProductReviewsQuery } from './get-product-reviews.query';

export interface ProductReviews {
  /** A page of the reviews that carry a comment. */
  items: ReviewListItem[];
  /** How many reviews carry a comment: what `page`/`pageSize` index into. */
  total: number;
  page: number;
  pageSize: number;
  /** Covers every rating, including the ones left without a comment. */
  summary: RatingSummary;
  /**
   * The reader's own review, so the form can show what they already gave.
   * Returned separately because a rating without a comment is not in `items`.
   */
  viewerReview: Review | null;
}

@QueryHandler(GetProductReviewsQuery)
export class GetProductReviewsHandler implements IQueryHandler<
  GetProductReviewsQuery,
  ProductReviews
> {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async execute(query: GetProductReviewsQuery): Promise<ProductReviews> {
    const skip = (query.page - 1) * query.pageSize;

    const [items, total, summary, viewerReview] = await Promise.all([
      this.reviewRepository.findWrittenByProduct({
        productId: query.productId,
        skip,
        take: query.pageSize,
      }),
      this.reviewRepository.countWrittenByProduct(query.productId),
      this.reviewRepository.summarize(query.productId),
      query.viewerId
        ? this.reviewRepository.findByProductAndUser(
            query.productId,
            query.viewerId,
          )
        : null,
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary,
      viewerReview,
    };
  }
}
