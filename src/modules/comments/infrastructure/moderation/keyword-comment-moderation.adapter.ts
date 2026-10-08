import { Injectable } from '@nestjs/common';
import {
  CommentModerationPort,
  ModerationResult,
} from '@/modules/comments/domain/services/comment-moderation.port';

// v1 of the "respect policy" enforcement: a small curated wordlist plus a
// couple of cheap heuristics, no external API call and no added infra
// dependency. Still used as the local fallback behind
// FallbackCommentModerationAdapter when the feelings-analysis service is
// unreachable or not configured — see comments.module.ts and backend
// CLAUDE.md's progress log.
const BLOCKED_WORDS = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'cunt',
  'faggot',
  'retard',
  'whore',
  'slut',
];

const BLOCKED_WORD_PATTERN = new RegExp(
  `\\b(${BLOCKED_WORDS.join('|')})\\b`,
  'i',
);

function looksLikeShouting(body: string): boolean {
  const letters = body.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 10) {
    return false;
  }
  const upper = letters.replace(/[^A-Z]/g, '');
  return upper.length / letters.length > 0.7;
}

function looksLikeHarassment(body: string): boolean {
  return /[!?]{4,}/.test(body);
}

const REJECTION_REASON = 'Please keep comments respectful.';

@Injectable()
export class KeywordCommentModerationAdapter implements CommentModerationPort {
  // Not `async`: the check is synchronous. It returns a resolved promise
  // because the port is asynchronous (the HTTP adapter has to be).
  review(body: string): Promise<ModerationResult> {
    const blocked =
      BLOCKED_WORD_PATTERN.test(body) ||
      looksLikeShouting(body) ||
      looksLikeHarassment(body);

    return Promise.resolve(
      blocked
        ? { allowed: false, reason: REJECTION_REASON }
        : { allowed: true },
    );
  }
}
