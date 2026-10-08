import { NotFoundException } from '@nestjs/common';
import { Comment } from '@/modules/comments/domain/entities/comment.entity';
import type { CommentLikeRepository } from '@/modules/comments/domain/repositories/comment-like.repository';
import type { CommentRepository } from '@/modules/comments/domain/repositories/comment.repository';
import { createMockCommentLikeRepository } from '@/modules/comments/testing/mock-comment-like-repository';
import { createMockCommentRepository } from '@/modules/comments/testing/mock-comment-repository';
import { SetCommentLikeCommand } from './set-comment-like.command';
import { SetCommentLikeHandler } from './set-comment-like.handler';

describe('SetCommentLikeHandler', () => {
  let comments: jest.Mocked<CommentRepository>;
  let likes: jest.Mocked<CommentLikeRepository>;
  let handler: SetCommentLikeHandler;

  const comment = Comment.create({
    productId: 'product-1',
    userId: 'author-1',
    body: 'Great product',
  });

  beforeEach(() => {
    comments = createMockCommentRepository();
    likes = createMockCommentLikeRepository();
    handler = new SetCommentLikeHandler(comments, likes);
    comments.findById.mockResolvedValue(comment);
  });

  it('likes a comment and returns the recounted total', async () => {
    likes.countFor.mockResolvedValue(3);

    const result = await handler.execute(
      new SetCommentLikeCommand(comment.id, 'user-2', true),
    );

    expect(likes.like).toHaveBeenCalledWith(comment.id, 'user-2');
    expect(likes.unlike).not.toHaveBeenCalled();
    expect(result).toEqual({
      commentId: comment.id,
      liked: true,
      likeCount: 3,
    });
  });

  it('unlikes a comment and returns the recounted total', async () => {
    likes.countFor.mockResolvedValue(2);

    const result = await handler.execute(
      new SetCommentLikeCommand(comment.id, 'user-2', false),
    );

    expect(likes.unlike).toHaveBeenCalledWith(comment.id, 'user-2');
    expect(likes.like).not.toHaveBeenCalled();
    expect(result).toEqual({
      commentId: comment.id,
      liked: false,
      likeCount: 2,
    });
  });

  it('reports the count from the repository, not the client', async () => {
    // The handler must never derive the new total arithmetically — a stale
    // tab clicking like twice has to converge on whatever the DB says.
    likes.countFor.mockResolvedValue(7);

    const result = await handler.execute(
      new SetCommentLikeCommand(comment.id, 'user-2', true),
    );

    expect(result.likeCount).toBe(7);
  });

  it('allows liking your own comment', async () => {
    likes.countFor.mockResolvedValue(1);

    await expect(
      handler.execute(new SetCommentLikeCommand(comment.id, 'author-1', true)),
    ).resolves.toMatchObject({ liked: true });
  });

  it('404s on a comment that does not exist', async () => {
    comments.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new SetCommentLikeCommand('missing', 'user-2', true)),
    ).rejects.toThrow(NotFoundException);
    expect(likes.like).not.toHaveBeenCalled();
  });
});
