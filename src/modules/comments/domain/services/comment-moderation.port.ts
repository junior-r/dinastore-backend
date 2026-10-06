export const COMMENT_MODERATION_PORT = Symbol('COMMENT_MODERATION_PORT');

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Seam for the "respect policy" enforced at comment creation. CreateCommentHandler
 * depends only on this interface. Async because the primary implementation
 * (HttpCommentModerationAdapter) calls the feelings-analysis service over
 * HTTP — see infrastructure/moderation/ for that adapter, the
 * KeywordCommentModerationAdapter fallback, and FallbackCommentModerationAdapter
 * which composes the two.
 */
export interface CommentModerationPort {
  review(body: string): Promise<ModerationResult>;
}
