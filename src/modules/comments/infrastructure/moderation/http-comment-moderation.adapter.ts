import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ENV_DEFAULTS } from '@/shared/infrastructure/config/env';
import {
  CommentModerationPort,
  ModerationResult,
} from '@/modules/comments/domain/services/comment-moderation.port';

interface FeelingsAnalysisResponse {
  approved: boolean;
  score: number;
  triggered_categories: string[];
}

// Calls the standalone feelings-analysis service (see ../../../../../../feelings-analysis)
// which scores text via OpenAI's Moderation API. Authenticates with a
// private X-API-Key header — feelings-analysis rejects any request with a
// missing/wrong key immediately (401), before doing any processing.
//
// This adapter never guesses on failure: a non-2xx response, network error,
// or timeout is thrown, not swallowed. FallbackCommentModerationAdapter is
// what decides what happens next (falls back to the local keyword filter),
// so a bad/missing key or an unreachable service can never silently bypass
// moderation and auto-approve a comment.
@Injectable()
export class HttpCommentModerationAdapter implements CommentModerationPort {
  private readonly url: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService) {
    this.url = configService.getOrThrow<string>('FEELINGS_ANALYSIS_URL');
    this.apiKey = configService.getOrThrow<string>('FEELINGS_ANALYSIS_API_KEY');
    this.timeoutMs = Number(
      configService.get<string>(
        'FEELINGS_ANALYSIS_TIMEOUT_MS',
        ENV_DEFAULTS.FEELINGS_ANALYSIS_TIMEOUT_MS,
      ),
    );
  }

  async review(body: string): Promise<ModerationResult> {
    const response = await fetch(`${this.url}/v1/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ text: body }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `feelings-analysis responded with ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as FeelingsAnalysisResponse;

    return {
      allowed: data.approved,
      reason: data.approved ? undefined : 'Please keep comments respectful.',
    };
  }
}
