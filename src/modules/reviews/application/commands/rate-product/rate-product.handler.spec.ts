import { NotFoundException } from '@nestjs/common';
import { DomainError } from '@/shared/domain/domain-error';
import type { ProductLookupPort } from '@/modules/comments/domain/ports/product-lookup.port';
import type { CommentModerationPort } from '@/modules/comments/domain/services/comment-moderation.port';
import { createMockCommentModeration } from '@/modules/comments/testing/mock-comment-moderation';
import { createMockProductLookup } from '@/modules/comments/testing/mock-product-lookup';
import { Review } from '@/modules/reviews/domain/entities/review.entity';
import type { ReviewRepository } from '@/modules/reviews/domain/repositories/review.repository';
import { createMockReviewRepository } from '@/modules/reviews/testing/mock-review-repository';
import { RateProductCommand } from './rate-product.command';
import { RateProductHandler } from './rate-product.handler';

describe('RateProductHandler', () => {
  let repository: jest.Mocked<ReviewRepository>;
  let productLookup: jest.Mocked<ProductLookupPort>;
  let moderation: jest.Mocked<CommentModerationPort>;
  let handler: RateProductHandler;

  beforeEach(() => {
    repository = createMockReviewRepository();
    productLookup = createMockProductLookup();
    moderation = createMockCommentModeration();
    handler = new RateProductHandler(repository, productLookup, moderation);
    productLookup.exists.mockResolvedValue(true);
  });

  it('saves a rating without a comment and skips moderation', async () => {
    const review = await handler.execute(
      new RateProductCommand('product-1', 'user-1', 4),
    );

    expect(review.rating).toBe(4);
    expect(review.body).toBeNull();
    expect(moderation.review).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('saves a rating with a comment once moderation allows it', async () => {
    const review = await handler.execute(
      new RateProductCommand('product-1', 'user-1', 5, ' Love it '),
    );

    expect(moderation.review).toHaveBeenCalledWith('Love it');
    expect(review.body).toBe('Love it');
  });

  it('does not send a blank comment to moderation', async () => {
    await handler.execute(
      new RateProductCommand('product-1', 'user-1', 5, ' '),
    );

    expect(moderation.review).not.toHaveBeenCalled();
  });

  it('revises the existing review instead of creating a second one', async () => {
    const existing = Review.create({
      productId: 'product-1',
      userId: 'user-1',
      rating: 2,
      body: 'Meh',
    });
    repository.findByProductAndUser.mockResolvedValue(existing);

    const review = await handler.execute(
      new RateProductCommand('product-1', 'user-1', 5),
    );

    expect(review.id).toBe(existing.id);
    expect(review.rating).toBe(5);
    expect(review.body).toBeNull();
  });

  it('404s on a product that does not exist', async () => {
    productLookup.exists.mockResolvedValue(false);

    await expect(
      handler.execute(new RateProductCommand('missing', 'user-1', 5)),
    ).rejects.toThrow(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range rating before anything is saved', async () => {
    await expect(
      handler.execute(new RateProductCommand('product-1', 'user-1', 6)),
    ).rejects.toThrow(DomainError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects a comment that fails moderation and saves nothing', async () => {
    moderation.review.mockResolvedValue({
      allowed: false,
      reason: 'Please keep comments respectful.',
    });

    await expect(
      handler.execute(new RateProductCommand('product-1', 'user-1', 1, 'rude')),
    ).rejects.toThrow('Please keep comments respectful.');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
