import type { ProductViewRepository } from '@/modules/analytics/domain/repositories/product-view.repository';
import { createMockProductViewRepository } from '@/modules/analytics/testing/mock-product-view-repository';
import { MAX_CHART_DAYS, ViewInsightsReader } from './view-insights.reader';

describe('ViewInsightsReader', () => {
  let views: jest.Mocked<ProductViewRepository>;
  let reader: ViewInsightsReader;

  // Noon UTC, so with a zero offset "today" is unambiguously 2026-10-07.
  const now = new Date('2026-10-07T12:00:00.000Z');

  beforeEach(() => {
    views = createMockProductViewRepository();
    reader = new ViewInsightsReader(views);
    views.totals.mockResolvedValue({
      views: 0,
      visitors: 0,
      products: 0,
      totalDurationMs: 0,
      favorites: 0,
    });
    views.daily.mockResolvedValue([]);
    views.byCountry.mockResolvedValue([]);
    views.groupByProduct.mockResolvedValue([]);
    views.productWindows.mockResolvedValue([]);
  });

  it('derives the average time and favorite rate from the totals', async () => {
    views.totals.mockResolvedValue({
      views: 4,
      visitors: 3,
      products: 2,
      totalDurationMs: 10_000,
      favorites: 1,
    });

    const { totals } = await reader.read({}, 0, now);

    expect(totals.avgDurationMs).toBe(2500);
    expect(totals.favoriteRate).toBe(0.25);
  });

  it('reports zeros rather than dividing by no visits', async () => {
    const { totals } = await reader.read({}, 0, now);

    expect(totals.avgDurationMs).toBe(0);
    expect(totals.favoriteRate).toBe(0);
  });

  it('charts the last 30 days, zero-filled, when no range is given', async () => {
    const { daily } = await reader.read({}, 0, now);

    expect(daily).toHaveLength(30);
    expect(daily[0].day).toBe('2026-09-08');
    expect(daily[29].day).toBe('2026-10-07');
    expect(daily.every((entry) => entry.views === 0)).toBe(true);
  });

  it('charts exactly the requested range, `to` being exclusive', async () => {
    const { daily } = await reader.read(
      {
        from: new Date('2026-10-01T00:00:00.000Z'),
        to: new Date('2026-10-04T00:00:00.000Z'),
      },
      0,
      now,
    );

    expect(daily.map((entry) => entry.day)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('keeps the most recent days when the range is longer than a chart holds', async () => {
    const { daily } = await reader.read(
      { from: new Date('2020-01-01T00:00:00.000Z') },
      0,
      now,
    );

    expect(daily).toHaveLength(MAX_CHART_DAYS);
    expect(daily[daily.length - 1].day).toBe('2026-10-07');
  });

  it("uses the viewer's calendar day, not the UTC one", async () => {
    // 02:00 UTC on the 7th is still the evening of the 6th at UTC-4 (240).
    const { daily } = await reader.read(
      {},
      240,
      new Date('2026-10-07T02:00:00.000Z'),
    );

    expect(daily[daily.length - 1].day).toBe('2026-10-06');
  });

  it('forecasts from the last full days, ignoring the chart range but keeping other filters', async () => {
    await reader.read(
      {
        productId: 'product-1',
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-02-01T00:00:00.000Z'),
      },
      0,
      now,
    );

    // Second `daily` call is the forecast history.
    const [historyFilter] = views.daily.mock.calls[1];
    expect(historyFilter.productId).toBe('product-1');
    expect(historyFilter.from).toEqual(new Date('2026-09-09T00:00:00.000Z'));
    // Up to the start of today, so the day in progress is left out.
    expect(historyFilter.to).toEqual(new Date('2026-10-07T00:00:00.000Z'));

    const [windowFilter, windows] = views.productWindows.mock.calls[0];
    expect(windowFilter.from).toBeUndefined();
    expect(windowFilter.productId).toBe('product-1');
    expect(windows.end).toEqual(now);
    expect(windows.middle).toEqual(new Date('2026-09-30T12:00:00.000Z'));
    expect(windows.start).toEqual(new Date('2026-09-23T12:00:00.000Z'));
  });

  it('says so when there is not enough history to forecast', async () => {
    const { forecast } = await reader.read({}, 0, now);

    expect(forecast).toMatchObject({
      status: 'insufficient',
      daysOfHistory: 0,
    });
  });
});
