import type { CommentLikeRepository } from '../domain/repositories/comment-like.repository';

export function createMockCommentLikeRepository(): jest.Mocked<CommentLikeRepository> {
  return {
    like: jest.fn(),
    unlike: jest.fn(),
    countFor: jest.fn(),
  };
}
