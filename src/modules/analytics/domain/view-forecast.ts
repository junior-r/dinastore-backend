import { addDays } from './product-view-stats';
import type { DailyViews, ProductWindowCounts } from './product-view-stats';

/**
 * Estimates, not promises. Everything here is plain arithmetic over the
 * recorded history (a straight-line trend, a weekday pattern, a comparison
 * of two weeks), chosen because it can be explained to whoever reads the
 * number and because the history is far too short for anything fancier to
 * do better.
 */

/** Days of history a forecast is fitted on, at most. */
export const FORECAST_HISTORY_DAYS = 28;
/** Days ahead a forecast covers. */
export const FORECAST_HORIZON_DAYS = 7;
/** Below this many days since the first recorded view, no forecast is made. */
export const MIN_FORECAST_HISTORY_DAYS = 7;
/** From this many days, the weekday pattern is trusted enough to apply. */
const MIN_DAYS_FOR_WEEKDAY_PATTERN = 21;
/** z for the central 80% of a normal distribution. */
const RANGE_Z = 1.28;
/** A forecast within this share of last week counts as "about the same". */
const FLAT_BAND = 0.1;

export interface ForecastDay {
  day: string;
  expected: number;
  /** Bottom of the likely range. Never below zero. */
  low: number;
  /** Top of the likely range. */
  high: number;
}

export type ForecastDirection = 'up' | 'down' | 'flat';

export type ViewForecast =
  | {
      status: 'ok';
      days: ForecastDay[];
      /** Sum of `expected`, `low` and `high` over the horizon. */
      expectedTotal: number;
      lowTotal: number;
      highTotal: number;
      /** Views in the last seven full days, what the forecast is compared to. */
      previousTotal: number;
      direction: ForecastDirection;
      /** Days of history the estimate was fitted on. */
      basedOnDays: number;
    }
  | {
      status: 'insufficient';
      /** Full days elapsed since the first recorded view. */
      daysOfHistory: number;
      daysNeeded: number;
    };

/**
 * Forecasts daily views for the days after `history`.
 *
 * `history` is one entry per day, oldest first, ending with the last *full*
 * day (today is still filling up, so it would read as a drop). Leading days
 * with no views are dropped first: before the first view ever recorded the
 * tracking did not exist, and counting that silence as zeros would invent a
 * steep upward trend.
 */
export function forecastViews(history: DailyViews[]): ViewForecast {
  const firstActive = history.findIndex((entry) => entry.views > 0);
  const observed = firstActive === -1 ? [] : history.slice(firstActive);

  if (observed.length < MIN_FORECAST_HISTORY_DAYS) {
    return {
      status: 'insufficient',
      daysOfHistory: observed.length,
      daysNeeded: MIN_FORECAST_HISTORY_DAYS,
    };
  }

  const values = observed.map((entry) => entry.views);
  const count = values.length;
  const mean = sum(values) / count;
  const { intercept, slope } = fitLine(values);
  const weekdayFactor =
    count >= MIN_DAYS_FOR_WEEKDAY_PATTERN
      ? weekdayFactors(observed, mean)
      : null;

  const predict = (index: number, day: string): number => {
    const trend = Math.max(0, intercept + slope * index);
    return weekdayFactor ? trend * weekdayFactor[weekdayOf(day)] : trend;
  };

  // How far the model was off on the days it has already seen is the best
  // available guide to how far off it will be on the ones it hasn't.
  const squaredError = sum(
    observed.map(
      (entry, index) => (entry.views - predict(index, entry.day)) ** 2,
    ),
  );
  const spread = RANGE_Z * Math.sqrt(squaredError / count);

  const lastDay = observed[count - 1].day;
  const days: ForecastDay[] = [];
  for (let step = 1; step <= FORECAST_HORIZON_DAYS; step++) {
    const day = addDays(lastDay, step);
    const expected = predict(count - 1 + step, day);
    days.push({
      day,
      expected: round1(expected),
      low: round1(Math.max(0, expected - spread)),
      high: round1(expected + spread),
    });
  }

  const expectedTotal = round1(sum(days.map((day) => day.expected)));
  const previousTotal = sum(values.slice(-FORECAST_HORIZON_DAYS));

  return {
    status: 'ok',
    days,
    expectedTotal,
    lowTotal: round1(sum(days.map((day) => day.low))),
    highTotal: round1(sum(days.map((day) => day.high))),
    previousTotal,
    direction: directionOf(expectedTotal, previousTotal),
    basedOnDays: count,
  };
}

export type MomentumDirection = 'new' | 'rising' | 'steady' | 'cooling';

export interface ProductMomentum extends ProductWindowCounts {
  /** Estimated views over the next window of the same length. */
  projected: number;
  direction: MomentumDirection;
}

/** A change smaller than this share of the earlier week is "steady". */
const MOMENTUM_BAND = 0.2;
/**
 * How much of last week's change is assumed to carry into next week. Half:
 * a product that doubled rarely doubles again, but it rarely snaps back
 * either.
 */
const MOMENTUM_CARRY = 0.5;

/**
 * Projects each product's next week from its last two, and ranks by that
 * projection. Products with no views in either week are left out.
 */
export function rankMomentum(
  counts: ProductWindowCounts[],
  limit: number,
): ProductMomentum[] {
  return counts
    .filter((entry) => entry.recent > 0 || entry.previous > 0)
    .map((entry) => ({
      ...entry,
      projected: Math.max(
        0,
        Math.round(
          entry.recent + (entry.recent - entry.previous) * MOMENTUM_CARRY,
        ),
      ),
      direction: momentumOf(entry.recent, entry.previous),
    }))
    .sort(
      (a, b) =>
        b.projected - a.projected ||
        b.recent - a.recent ||
        a.productName.localeCompare(b.productName),
    )
    .slice(0, limit);
}

function momentumOf(recent: number, previous: number): MomentumDirection {
  if (previous === 0) {
    return 'new';
  }
  const change = (recent - previous) / previous;
  if (change >= MOMENTUM_BAND) return 'rising';
  if (change <= -MOMENTUM_BAND) return 'cooling';
  return 'steady';
}

function directionOf(expected: number, previous: number): ForecastDirection {
  if (previous === 0) {
    return expected > 0 ? 'up' : 'flat';
  }
  const change = (expected - previous) / previous;
  if (change > FLAT_BAND) return 'up';
  if (change < -FLAT_BAND) return 'down';
  return 'flat';
}

/** Ordinary least squares over (0, y0), (1, y1), ... */
function fitLine(values: number[]): { intercept: number; slope: number } {
  const count = values.length;
  const meanX = (count - 1) / 2;
  const meanY = sum(values) / count;

  let covariance = 0;
  let variance = 0;
  values.forEach((value, index) => {
    covariance += (index - meanX) * (value - meanY);
    variance += (index - meanX) ** 2;
  });

  const slope = variance === 0 ? 0 : covariance / variance;
  return { intercept: meanY - slope * meanX, slope };
}

/**
 * For each weekday, how its average compares to the overall average: 1.3
 * means that weekday runs 30% busier than a typical day.
 */
function weekdayFactors(observed: DailyViews[], mean: number): number[] {
  const totals = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  for (const entry of observed) {
    const bucket = totals[weekdayOf(entry.day)];
    bucket.sum += entry.views;
    bucket.count += 1;
  }
  return totals.map((bucket) =>
    mean === 0 || bucket.count === 0 ? 1 : bucket.sum / bucket.count / mean,
  );
}

function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00.000Z`).getUTCDay();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
