import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { REVIEW_REPOSITORY } from '@/modules/reviews/domain/repositories/review.repository';
import type { ReviewRepository } from '@/modules/reviews/domain/repositories/review.repository';
import { DeleteReviewCommand } from './delete-review.command';

@CommandHandler(DeleteReviewCommand)
export class DeleteReviewHandler implements ICommandHandler<
  DeleteReviewCommand,
  void
> {
  constructor(
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepository: ReviewRepository,
  ) {}

  // The review is addressed by (product, requesting user), never by id, so
  // there is no way to name someone else's review here and no ownership check
  // to get wrong. Deleting one that isn't there succeeds: the end state the
  // caller asked for already holds.
  async execute(command: DeleteReviewCommand): Promise<void> {
    await this.reviewRepository.deleteByProductAndUser(
      command.productId,
      command.userId,
    );
  }
}
