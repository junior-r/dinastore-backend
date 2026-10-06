import { Injectable, Logger } from '@nestjs/common';
import type {
  CommentModerationPort,
  ModerationResult,
} from '@/modules/comments/domain/services/comment-moderation.port';

// Composes a primary and fallback moderation provider: tries primary first,
// and on any thrown error (wrong/missing key, timeout, service down, bad
// response shape) logs a warning and falls through to the fallback instead
// of letting the failure bubble up and silently bypass moderation.
@Injectable()
export class FallbackCommentModerationAdapter implements CommentModerationPort {
  private readonly logger = new Logger(FallbackCommentModerationAdapter.name);

  constructor(
    private readonly primary: CommentModerationPort,
    private readonly fallback: CommentModerationPort,
  ) {}

  async review(body: string): Promise<ModerationResult> {
    try {
      return await this.primary.review(body);
    } catch (error) {
      this.logger.warn(
        `Primary moderation provider failed, falling back to local rules: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.fallback.review(body);
    }
  }
}
