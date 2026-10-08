/** Read-side shapes for the aggregates over the product-view history. */

export interface ViewTotals {
  views: number;
  /** Distinct browsers. */
  visitors: number;
  /** Distinct products, counting a deleted product by its name snapshot. */
  products: number;
  totalDurationMs: number;
  /** Visits where the product was in the visitor's favorites. */
  favorites: number;
}

export interface DailyViews {
  /** Calendar day in the viewer's time zone, `YYYY-MM-DD`. */
  day: string;
  views: number;
  visitors: number;
  durationMs: number;
}

export interface CountryViews {
  /** ISO 3166-1 alpha-2. Null for visits that couldn't be placed. */
  country: string | null;
  views: number;
}

export interface ProductViewGroup {
  /** Null once the product has been deleted. */
  productId: string | null;
  productName: string;
  productSlug: string | null;
  views: number;
  visitors: number;
  totalDurationMs: number;
  favorites: number;
  lastViewedAt: Date;
}

export interface VisitorViewGroup {
  /** The account, or null for a browser that never signed in. */
  user: { id: string; name: string; email: string } | null;
  /** Set only when `user` is null: the browser's anonymous id. */
  visitorId: string | null;
  views: number;
  /** Distinct products this person looked at. */
  products: number;
  totalDurationMs: number;
  favorites: number;
  lastViewedAt: Date;
}

export interface ProductWindowCounts {
  productId: string | null;
  productName: string;
  productSlug: string | null;
  /** Visits in the more recent window. */
  recent: number;
  /** Visits in the window before it. */
  previous: number;
}

const MS_PER_DAY = 86_400_000;

/**
 * The calendar day an instant falls on for a viewer whose browser reports
 * `tzOffsetMinutes` from `Date#getTimezoneOffset`.
 */
export function localDay(instant: Date, tzOffsetMinutes: number): string {
  return new Date(instant.getTime() - tzOffsetMinutes * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** The instant a viewer's calendar day begins. Inverse of `localDay`. */
export function startOfLocalDay(day: string, tzOffsetMinutes: number): Date {
  return new Date(
    Date.parse(`${day}T00:00:00.000Z`) + tzOffsetMinutes * 60_000,
  );
}

export function addDays(day: string, amount: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + amount * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** Whole days from `first` to `last`. Zero when they are the same day. */
export function daysBetween(first: string, last: string): number {
  return Math.round(
    (Date.parse(`${last}T00:00:00.000Z`) -
      Date.parse(`${first}T00:00:00.000Z`)) /
      MS_PER_DAY,
  );
}

/**
 * Turns "the days that had visits" into one entry for every day from
 * `firstDay` to `lastDay` inclusive. A day with no visits is a real zero on a
 * chart and in a forecast, not a gap to be skipped.
 */
export function fillDays(
  sparse: DailyViews[],
  firstDay: string,
  lastDay: string,
): DailyViews[] {
  const byDay = new Map(sparse.map((entry) => [entry.day, entry]));
  const filled: DailyViews[] = [];

  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
    filled.push(
      byDay.get(day) ?? { day, views: 0, visitors: 0, durationMs: 0 },
    );
  }

  return filled;
}
