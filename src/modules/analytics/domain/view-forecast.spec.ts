import { addDays, fillDays } from './product-view-stats';
import type { DailyViews } from './product-view-stats';
import {
  FORECAST_HORIZON_DAYS,
  MIN_FORECAST_HISTORY_DAYS,
  forecastViews,
  rankMomentum,
} from './view-forecast';

// 2026-09-07 is a Monday.
const FIRST_DAY = '2026-09-07';

function history(views: number[]): DailyViews[] {
  return views.map((count, index) => ({
    day: addDays(FIRST_DAY, index),
    views: count,
    visitors: count,
    durationMs: 0,
  }));
}

describe('forecastViews', () => {
  it('refuses to forecast from less than a week of history', () => {
    expect(forecastViews(history([3, 4, 5]))).toEqual({
      status: 'insufficient',
      daysOfHistory: 3,
      daysNeeded: MIN_FORECAST_HISTORY_DAYS,
    });
  });

  it('reports no history at all as zero days', () => {
    expect(forecastViews(history([0, 0, 0, 0, 0, 0, 0, 0]))).toMatchObject({
      status: 'insufficient',
      daysOfHistory: 0,
    });
  });

  it('does not count the silence before the first view as history', () => {
    // 20 empty days then 3 real ones: three days of history, not 23.
    const forecast = forecastViews(
      history([...Array<number>(20).fill(0), 5, 6, 7]),
    );

    expect(forecast).toMatchObject({
      status: 'insufficient',
      daysOfHistory: 3,
    });
  });

  it('keeps a flat history flat, with no spread', () => {
    const forecast = forecastViews(history(Array<number>(10).fill(8)));

    if (forecast.status !== 'ok') throw new Error('expected a forecast');
    expect(forecast.days).toHaveLength(FORECAST_HORIZON_DAYS);
    expect(forecast.days.every((day) => day.expected === 8)).toBe(true);
    expect(forecast.days.every((day) => day.low === 8 && day.high === 8)).toBe(
      true,
    );
    expect(forecast.expectedTotal).toBe(56);
    expect(forecast.previousTotal).toBe(56);
    expect(forecast.direction).toBe('flat');
    expect(forecast.basedOnDays).toBe(10);
  });

  it('continues a steady climb and calls it up', () => {
    // 1, 2, ... 10: the line is exact, so the next days are 11, 12, ...
    const forecast = forecastViews(
      history(Array.from({ length: 10 }, (_, index) => index + 1)),
    );

    if (forecast.status !== 'ok') throw new Error('expected a forecast');
    expect(forecast.days.map((day) => day.expected)).toEqual([
      11, 12, 13, 14, 15, 16, 17,
    ]);
    expect(forecast.direction).toBe('up');
  });

  it('starts the forecast the day after the history ends', () => {
    const forecast = forecastViews(history(Array<number>(7).fill(2)));

    if (forecast.status !== 'ok') throw new Error('expected a forecast');
    expect(forecast.days[0].day).toBe(addDays(FIRST_DAY, 7));
    expect(forecast.days[6].day).toBe(addDays(FIRST_DAY, 13));
  });

  it('never forecasts below zero on a decline', () => {
    const forecast = forecastViews(history([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]));

    if (forecast.status !== 'ok') throw new Error('expected a forecast');
    expect(forecast.days.every((day) => day.expected >= 0)).toBe(true);
    expect(forecast.days.every((day) => day.low >= 0)).toBe(true);
    expect(forecast.direction).toBe('down');
  });

  it('widens the range when the history is noisy', () => {
    const forecast = forecastViews(history([2, 14, 3, 12, 1, 15, 4, 13, 2]));

    if (forecast.status !== 'ok') throw new Error('expected a forecast');
    const [first] = forecast.days;
    expect(first.high - first.low).toBeGreaterThan(5);
    expect(first.low).toBeLessThan(first.expected);
    expect(first.high).toBeGreaterThan(first.expected);
  });

  it('applies the weekday pattern once there are three weeks of it', () => {
    // Four weeks, Monday first: weekends three times as busy as weekdays.
    const week = [10, 10, 10, 10, 10, 30, 30];
    const forecast = forecastViews(
      history([...week, ...week, ...week, ...week]),
    );

    if (forecast.status !== 'ok') throw new Error('expected a forecast');
    // The forecast starts on a Monday again.
    const [monday, , , , , saturday, sunday] = forecast.days;
    expect(saturday.expected).toBeGreaterThan(monday.expected * 2);
    expect(sunday.expected).toBeGreaterThan(monday.expected * 2);
  });

  it('ignores the weekday pattern when there is too little to trust', () => {
    const forecast = forecastViews(history([10, 10, 10, 10, 10, 30, 30, 10]));

    if (forecast.status !== 'ok') throw new Error('expected a forecast');
    // A straight line: every day differs from the one before by the same
    // slope, with no weekend bump. (Rounded to one decimal, hence the 0.11.)
    const steps = forecast.days
      .slice(1)
      .map((day, index) => day.expected - forecast.days[index].expected);
    expect(Math.max(...steps) - Math.min(...steps)).toBeLessThan(0.11);
  });
});

describe('fillDays', () => {
  it('adds a zero entry for every day with no visits', () => {
    const filled = fillDays(
      [{ day: '2026-09-08', views: 4, visitors: 2, durationMs: 100 }],
      '2026-09-07',
      '2026-09-09',
    );

    expect(filled).toEqual([
      { day: '2026-09-07', views: 0, visitors: 0, durationMs: 0 },
      { day: '2026-09-08', views: 4, visitors: 2, durationMs: 100 },
      { day: '2026-09-09', views: 0, visitors: 0, durationMs: 0 },
    ]);
  });

  it('crosses a month boundary', () => {
    expect(
      fillDays([], '2026-09-29', '2026-10-02').map((entry) => entry.day),
    ).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
  });
});

describe('rankMomentum', () => {
  const product = (name: string, recent: number, previous: number) => ({
    productId: name,
    productName: name,
    productSlug: name,
    recent,
    previous,
  });

  it('labels each product by how its last week compares to the one before', () => {
    const ranked = rankMomentum(
      [
        product('new', 4, 0),
        product('rising', 12, 6),
        product('steady', 10, 9),
        product('cooling', 3, 10),
      ],
      10,
    );

    expect(
      Object.fromEntries(
        ranked.map((entry) => [entry.productName, entry.direction]),
      ),
    ).toEqual({
      new: 'new',
      rising: 'rising',
      steady: 'steady',
      cooling: 'cooling',
    });
  });

  it('projects next week by carrying half of the change forward', () => {
    const [rising] = rankMomentum([product('rising', 12, 6)], 1);
    const [cooling] = rankMomentum([product('cooling', 3, 10)], 1);

    expect(rising.projected).toBe(15);
    // 3 + (3 - 10) / 2 = -0.5, floored at zero.
    expect(cooling.projected).toBe(0);
  });

  it('ranks by the projection, leaves out idle products and honours the limit', () => {
    const ranked = rankMomentum(
      [
        product('small', 2, 2),
        product('idle', 0, 0),
        product('big', 20, 10),
        product('mid', 8, 8),
      ],
      2,
    );

    expect(ranked.map((entry) => entry.productName)).toEqual(['big', 'mid']);
  });
});
