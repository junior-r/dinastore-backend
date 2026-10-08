import { Review } from '@/modules/reviews/domain/entities/review.entity';
import { summarizeRatings } from '@/modules/reviews/domain/rating-summary';
import type { ReviewRepository } from '@/modules/reviews/domain/repositories/review.repository';
import { createMockReviewRepository } from '@/modules/reviews/testing/mock-review-repository';
import { GetProductReviewsHandler } from './get-product-reviews.handler';
import { GetProductReviewsQuery } from './get-product-reviews.query';

describe('GetProductReviewsHandler', () => {
  let repository: jest.Mocked<ReviewRepository>;
  let handler: GetProductReviewsHandler;

  const summary = summarizeRatings(new Map([[5, 2]]));

  beforeEach(() => {
    repository = createMockReviewRepository();
    handler = new GetProductReviewsHandler(repository);
    repository.summarize.mockResolvedValue(summary);
  });

  it('returns the page, the written total and the summary', async () => {
    repository.countWrittenByProduct.mockResolvedValue(41);

    const result = await handler.execute(
      new GetProductReviewsQuery('product-1', 3, 10),
    );

    expect(repository.findWrittenByProduct).toHaveBeenCalledWith({
      productId: 'product-1',
      skip: 20,
      take: 10,
    });
    expect(result).toMatchObject({
      total: 41,
      page: 3,
      pageSize: 10,
      summary,
    });
  });

  it('does not look up a viewer review for an anonymous reader', async () => {
    const result = await handler.execute(
      new GetProductReviewsQuery('product-1'),
    );

    expect(repository.findByProductAndUser).not.toHaveBeenCalled();
    expect(result.viewerReview).toBeNull();
  });

  it("returns the signed-in reader's own review", async () => {
    const mine = Review.create({
      productId: 'product-1',
      userId: 'user-1',
      rating: 3,
    });
    repository.findByProductAndUser.mockResolvedValue(mine);

    const result = await handler.execute(
      new GetProductReviewsQuery('product-1', 1, 20, 'user-1'),
    );

    expect(repository.findByProductAndUser).toHaveBeenCalledWith(
      'product-1',
      'user-1',
    );
    expect(result.viewerReview).toBe(mine);
  });

  it('falls back to sane paging for out-of-range values', () => {
    const query = new GetProductReviewsQuery('product-1', 0, 5000);

    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(100);
  });
});
