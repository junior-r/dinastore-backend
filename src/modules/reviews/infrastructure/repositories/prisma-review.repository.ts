import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PRISMA_ERROR } from '@/shared/infrastructure/prisma/prisma-error-codes';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { Review } from '@/modules/reviews/domain/entities/review.entity';
import type { ReviewProps } from '@/modules/reviews/domain/entities/review.entity';
import { summarizeRatings } from '@/modules/reviews/domain/rating-summary';
import type { RatingSummary } from '@/modules/reviews/domain/rating-summary';
import {
  FindReviewsParams,
  ReviewListItem,
  ReviewRepository,
} from '@/modules/reviews/domain/repositories/review.repository';

const authorInclude = {
  select: { id: true, name: true, avatarUrl: true },
} as const;

function toDomain(record: ReviewProps): Review {
  return Review.fromPersistence({
    id: record.id,
    productId: record.productId,
    userId: record.userId,
    rating: record.rating,
    body: record.body,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

@Injectable()
export class PrismaReviewRepository implements ReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(review: Review): Promise<Review> {
    const props = review.toPersistenceProps();
    const where = {
      productId_userId: { productId: props.productId, userId: props.userId },
    };
    const content = { rating: props.rating, body: props.body };

    try {
      // Keyed on (product, user) rather than the id, so the one-review-per-
      // shopper rule holds even if the caller built a fresh entity.
      const record = await this.prisma.productReview.upsert({
        where,
        create: {
          id: props.id,
          productId: props.productId,
          userId: props.userId,
          ...content,
        },
        update: content,
      });
      return toDomain(record);
    } catch (error) {
      // Same race PrismaCommentLikeRepository.like documents: upsert is a
      // read-then-write, so two concurrent first ratings (a double click on
      // a star) can both try to insert and the loser gets P2002. The row now
      // exists, so apply this request's content to it instead of failing.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_ERROR.UNIQUE_CONSTRAINT
      ) {
        const record = await this.prisma.productReview.update({
          where,
          data: content,
        });
        return toDomain(record);
      }
      throw error;
    }
  }

  async findByProductAndUser(
    productId: string,
    userId: string,
  ): Promise<Review | null> {
    const record = await this.prisma.productReview.findUnique({
      where: { productId_userId: { productId, userId } },
    });
    return record ? toDomain(record) : null;
  }

  async deleteByProductAndUser(
    productId: string,
    userId: string,
  ): Promise<void> {
    // deleteMany (not delete) so removing a review that isn't there doesn't
    // throw P2025.
    await this.prisma.productReview.deleteMany({
      where: { productId, userId },
    });
  }

  async findWrittenByProduct(
    params: FindReviewsParams,
  ): Promise<ReviewListItem[]> {
    const records = await this.prisma.productReview.findMany({
      where: { productId: params.productId, body: { not: null } },
      include: { user: authorInclude },
      // id breaks ties so paging is stable when two rows share a timestamp.
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: params.skip,
      take: params.take,
    });

    return records.map((record) => ({
      id: record.id,
      productId: record.productId,
      rating: record.rating,
      body: record.body,
      author: record.user,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async countWrittenByProduct(productId: string): Promise<number> {
    return this.prisma.productReview.count({
      where: { productId, body: { not: null } },
    });
  }

  async summarize(productId: string): Promise<RatingSummary> {
    // At most five groups come back, so the average is derived from them
    // rather than asking the database a second question.
    const groups = await this.prisma.productReview.groupBy({
      by: ['rating'],
      where: { productId },
      _count: { _all: true },
    });

    return summarizeRatings(
      new Map(groups.map((group) => [group.rating, group._count._all])),
    );
  }
}
