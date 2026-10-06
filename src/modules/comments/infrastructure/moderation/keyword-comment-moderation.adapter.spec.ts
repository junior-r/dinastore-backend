import { KeywordCommentModerationAdapter } from './keyword-comment-moderation.adapter';

describe('KeywordCommentModerationAdapter', () => {
  const adapter = new KeywordCommentModerationAdapter();

  it('allows a normal, respectful comment', async () => {
    await expect(
      adapter.review('This shirt fits great and the fabric is soft.'),
    ).resolves.toEqual({ allowed: true });
  });

  it('rejects a comment containing a blocked word, case-insensitively', async () => {
    const result = await adapter.review('What a piece of Shit product');
    expect(result.allowed).toBe(false);
  });

  it('does not false-positive on legitimate words containing a blocked substring', async () => {
    // word-boundary matching: "shitake" contains "shit" as a prefix but
    // isn't the word "shit" on its own, so it must not trip the filter.
    const result = await adapter.review('I love shitake mushrooms on pizza');
    expect(result.allowed).toBe(true);
  });

  it('rejects a shouted comment (mostly uppercase, long enough)', async () => {
    const result = await adapter.review(
      'THIS PRODUCT IS COMPLETELY AWFUL AND USELESS',
    );
    expect(result.allowed).toBe(false);
  });

  it('allows a short all-caps comment (e.g. an acronym)', async () => {
    const result = await adapter.review('USA sizing runs small');
    expect(result.allowed).toBe(true);
  });

  it('rejects a comment with harassment-style repeated punctuation', async () => {
    const result = await adapter.review('Why is this so bad????');
    expect(result.allowed).toBe(false);
  });

  it('returns a user-facing reason when rejecting', async () => {
    const result = await adapter.review('fuck this');
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/respectful/i);
  });
});
