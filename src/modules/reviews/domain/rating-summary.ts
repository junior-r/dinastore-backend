import { MAX_RATING, MIN_RATING } from './entities/review.entity';

export interface RatingSummary {
  /** Mean of every rating, to two decimals. Null while nobody has rated. */
  average: number | null;
  /** Every rating, with or without a comment. */
  count: number;
  /** How many ratings each star value got, keyed 1..5. Always all five keys. */
  distribution: Record<number, number>;
}

/**
 * Builds the summary from "how many ratings per star value". Star values the
 * product never received are simply absent from the input.
 */
export function summarizeRatings(
  countsByRating: ReadonlyMap<number, number>,
): RatingSummary {
  const distribution: Record<number, number> = {};
  let count = 0;
  let sum = 0;

  for (let rating = MIN_RATING; rating <= MAX_RATING; rating++) {
    const ratingCount = countsByRating.get(rating) ?? 0;
    distribution[rating] = ratingCount;
    count += ratingCount;
    sum += rating * ratingCount;
  }

  return {
    average: count === 0 ? null : Math.round((sum / count) * 100) / 100,
    count,
    distribution,
  };
}
