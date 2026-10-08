import type { ReviewRepository } from '@/modules/reviews/domain/repositories/review.repository';
import { createMockReviewRepository } from '@/modules/reviews/testing/mock-review-repository';
import { DeleteReviewCommand } from './delete-review.command';
import { DeleteReviewHandler } from './delete-review.handler';

describe('DeleteReviewHandler', () => {
  let repository: jest.Mocked<ReviewRepository>;
  let handler: DeleteReviewHandler;

  beforeEach(() => {
    repository = createMockReviewRepository();
    handler = new DeleteReviewHandler(repository);
  });

  it("deletes the requesting user's review of the product", async () => {
    await handler.execute(new DeleteReviewCommand('product-1', 'user-1'));

    expect(repository.deleteByProductAndUser).toHaveBeenCalledWith(
      'product-1',
      'user-1',
    );
  });
});
