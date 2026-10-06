import type { CommentModerationPort } from '../domain/services/comment-moderation.port';

export function createMockCommentModeration(): jest.Mocked<CommentModerationPort> {
  return {
    review: jest.fn().mockResolvedValue({ allowed: true }),
  };
}
