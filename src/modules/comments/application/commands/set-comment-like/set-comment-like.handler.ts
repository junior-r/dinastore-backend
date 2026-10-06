import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { COMMENT_LIKE_REPOSITORY } from '@/modules/comments/domain/repositories/comment-like.repository';
import type { CommentLikeRepository } from '@/modules/comments/domain/repositories/comment-like.repository';
import { COMMENT_REPOSITORY } from '@/modules/comments/domain/repositories/comment.repository';
import type { CommentRepository } from '@/modules/comments/domain/repositories/comment.repository';
import { SetCommentLikeCommand } from './set-comment-like.command';

export interface CommentLikeState {
  commentId: string;
  liked: boolean;
  likeCount: number;
}

@CommandHandler(SetCommentLikeCommand)
export class SetCommentLikeHandler implements ICommandHandler<
  SetCommentLikeCommand,
  CommentLikeState
> {
  constructor(
    @Inject(COMMENT_REPOSITORY)
    private readonly commentRepository: CommentRepository,
    @Inject(COMMENT_LIKE_REPOSITORY)
    private readonly likeRepository: CommentLikeRepository,
  ) {}

  async execute(command: SetCommentLikeCommand): Promise<CommentLikeState> {
    const comment = await this.commentRepository.findById(command.commentId);
    if (!comment) {
      throw new NotFoundException(`Comment "${command.commentId}" not found`);
    }

    // Deliberately no self-like restriction — liking your own comment is
    // allowed, as it is on every platform this mirrors.
    if (command.liked) {
      await this.likeRepository.like(command.commentId, command.userId);
    } else {
      await this.likeRepository.unlike(command.commentId, command.userId);
    }

    // Re-read rather than trusting the client's optimistic count, so a
    // double-click or a stale tab converges on the real total.
    const likeCount = await this.likeRepository.countFor(command.commentId);

    return { commentId: command.commentId, liked: command.liked, likeCount };
  }
}
