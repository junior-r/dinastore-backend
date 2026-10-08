import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PassportModule } from '@nestjs/passport';
import { CommentsModule } from '@/modules/comments/comments.module';
import { DeleteReviewHandler } from './application/commands/delete-review/delete-review.handler';
import { RateProductHandler } from './application/commands/rate-product/rate-product.handler';
import { GetProductReviewsHandler } from './application/queries/get-product-reviews/get-product-reviews.handler';
import { REVIEW_REPOSITORY } from './domain/repositories/review.repository';
import { PrismaReviewRepository } from './infrastructure/repositories/prisma-review.repository';
import { ReviewsController } from './presentation/controllers/reviews.controller';

const commandHandlers = [RateProductHandler, DeleteReviewHandler];
const queryHandlers = [GetProductReviewsHandler];

@Module({
  // CommentsModule is imported for two ports it already owns and exports:
  // "does this product exist" and text moderation. A review's comment is
  // held to the same policy as a product comment, so it goes through the
  // same adapter chain instead of a second copy of it.
  imports: [CqrsModule, PassportModule, CommentsModule],
  controllers: [ReviewsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: REVIEW_REPOSITORY, useClass: PrismaReviewRepository },
  ],
})
export class ReviewsModule {}
