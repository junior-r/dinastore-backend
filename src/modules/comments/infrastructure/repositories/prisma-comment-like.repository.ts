import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma/client';
import { PRISMA_ERROR } from '@/shared/infrastructure/prisma/prisma-error-codes';
import { PrismaService } from '@/shared/infrastructure/prisma/prisma.service';
import { CommentLikeRepository } from '@/modules/comments/domain/repositories/comment-like.repository';

@Injectable()
export class PrismaCommentLikeRepository implements CommentLikeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async like(commentId: string, userId: string): Promise<void> {
    try {
      // Upsert (not create) so a sequential double-click is a no-op.
      await this.prisma.commentLike.upsert({
        where: { commentId_userId: { commentId, userId } },
        create: { commentId, userId },
        update: {},
      });
    } catch (error) {
      // Prisma's upsert is a read-then-write, not a single atomic statement,
      // so two *concurrent* likes of the same comment can both find no row
      // and both try to insert — the loser gets P2002. The row it collided
      // with is exactly the row it wanted, so the desired end state already
      // holds and this is a success, not a 409. Observed in practice by
      // clicking the heart rapidly, which surfaced as an error toast.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === PRISMA_ERROR.UNIQUE_CONSTRAINT
      ) {
        return;
      }
      throw error;
    }
  }

  async unlike(commentId: string, userId: string): Promise<void> {
    // deleteMany (not delete) so unliking something never liked doesn't
    // throw P2025.
    await this.prisma.commentLike.deleteMany({
      where: { commentId, userId },
    });
  }

  async countFor(commentId: string): Promise<number> {
    return this.prisma.commentLike.count({ where: { commentId } });
  }
}
