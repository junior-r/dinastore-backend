import { ConfigService } from '@nestjs/config';
import { HttpCommentModerationAdapter } from './http-comment-moderation.adapter';

function mockResponse(overrides: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: () => Promise<unknown>;
}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({}),
    ...overrides,
  } as Response;
}

describe('HttpCommentModerationAdapter', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let adapter: HttpCommentModerationAdapter;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    const configService = new ConfigService({
      FEELINGS_ANALYSIS_URL: 'https://feelings-analysis.test',
      FEELINGS_ANALYSIS_API_KEY: 'test-service-key',
    });
    adapter = new HttpCommentModerationAdapter(configService);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('sends the body and the X-API-Key header to /v1/analyze', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        json: async () => ({
          approved: true,
          score: 0.01,
          triggered_categories: [],
        }),
      }),
    );

    await adapter.review('nice product');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://feelings-analysis.test/v1/analyze',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'test-service-key' }),
        body: JSON.stringify({ text: 'nice product' }),
      }),
    );
  });

  it('maps an approved response to allowed: true', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        json: async () => ({
          approved: true,
          score: 0.01,
          triggered_categories: [],
        }),
      }),
    );

    const result = await adapter.review('nice product');

    expect(result).toEqual({ allowed: true, reason: undefined });
  });

  it('maps a rejected response to allowed: false with a reason', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({
        json: async () => ({
          approved: false,
          score: 0.8,
          triggered_categories: ['harassment'],
        }),
      }),
    );

    const result = await adapter.review('mean comment');

    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/respectful/i);
  });

  it('throws when feelings-analysis returns a non-2xx status (e.g. wrong API key -> 401)', async () => {
    fetchSpy.mockResolvedValue(
      mockResponse({ ok: false, status: 401, statusText: 'Unauthorized' }),
    );

    await expect(adapter.review('hi')).rejects.toThrow(/401/);
  });

  it('propagates a network error', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    await expect(adapter.review('hi')).rejects.toThrow('fetch failed');
  });
});
