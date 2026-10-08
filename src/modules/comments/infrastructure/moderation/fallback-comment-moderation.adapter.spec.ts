import type { CommentModerationPort } from '@/modules/comments/domain/services/comment-moderation.port';
import { FallbackCommentModerationAdapter } from './fallback-comment-moderation.adapter';

function makeMockPort(): jest.Mocked<CommentModerationPort> {
  return { review: jest.fn() };
}

describe('FallbackCommentModerationAdapter', () => {
  it('returns the primary result when the primary succeeds', async () => {
    const primary = makeMockPort();
    const fallback = makeMockPort();
    primary.review.mockResolvedValue({ allowed: true });

    const adapter = new FallbackCommentModerationAdapter(primary, fallback);
    const result = await adapter.review('hi');

    expect(result).toEqual({ allowed: true });
    expect(fallback.review).not.toHaveBeenCalled();
  });

  it('falls back to the fallback provider when the primary throws', async () => {
    const primary = makeMockPort();
    const fallback = makeMockPort();
    primary.review.mockRejectedValue(new Error('service unavailable'));
    fallback.review.mockResolvedValue({
      allowed: false,
      reason: 'Please keep comments respectful.',
    });

    const adapter = new FallbackCommentModerationAdapter(primary, fallback);
    const result = await adapter.review('hi');

    expect(fallback.review).toHaveBeenCalledWith('hi');
    expect(result).toEqual({
      allowed: false,
      reason: 'Please keep comments respectful.',
    });
  });
});
