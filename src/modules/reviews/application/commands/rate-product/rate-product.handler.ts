import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainError } from '@/shared/domain/domain-error';
import { PRODUCT_LOOKUP_PORT } from '@/modules/comments/domain/ports/product-lookup.port';
import type { ProductLookupPort } from '@/modules/comments/domain/ports/product-lookup.port';
import { COMMENT_MODERATION_PORT } from '@/modules/comments/domain/services/comment-moderation.port';
import type { CommentModerationPort } from '@/modules/comments/domain/services/comment-moderation.port';
import { Review } from '@/modules/reviews/domain/entities/review.entity';
import { REVIEW_REPOSITORY } from '@/modules/reviews/domain/repositories/review.repository';
import type { ReviewRepository } from '@/modules/reviews/domain/repositories/review.repository';
import { RateProductCommand } from './rate-product.command';

@CommandHandler(RateProductCommand)
export class RateProductHandler implements ICommandHandler<
  RateProductCommand,
  Review
> {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
    @Inject(PRODUCT_LOOKUP_PORT)
    private readonly productLookup: ProductLookupPort,
    @Inject(COMMENT_MODERATION_PORT)
    private readonly moderation: CommentModerationPort,
  ) {}

  async execute(command: RateProductCommand): Promise<Review> {
    if (!(await this.productLookup.exists(command.productId))) {
      throw new NotFoundException(`Product "${command.productId}" not found`);
    }

    const existing = await this.reviewRepository.findByProductAndUser(
      command.productId,
      command.userId,
    );
    const content = { rating: command.rating, body: command.body };
    const review = existing
      ? existing.revise(content)
      : Review.create({
          productId: command.productId,
          userId: command.userId,
          ...content,
        });

    // The comment is public text like any other, so it goes through the same
    // moderation as product comments. A rating on its own has nothing to
    // review, and skipping the call keeps a star click free of a network hop.
    if (review.body !== null) {
      const result = await this.moderation.review(review.body);
      if (!result.allowed) {
        throw new DomainError(
          result.reason ?? 'Please keep comments respectful.',
        );
      }
    }

    return this.reviewRepository.save(review);
  }
}
