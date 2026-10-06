export const COMMENT_LIKE_REPOSITORY = Symbol('COMMENT_LIKE_REPOSITORY');

export interface CommentLikeRepository {
  /** Idempotent — liking twice leaves exactly one row. */
  like(commentId: string, userId: string): Promise<void>;
  /** Idempotent — unliking something never liked is a no-op. */
  unlike(commentId: string, userId: string): Promise<void>;
  countFor(commentId: string): Promise<number>;
}
