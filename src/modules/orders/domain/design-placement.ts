import { DomainError } from '@/shared/domain/domain-error';

/**
 * Where a design sits on the garment photo the shopper positioned it on.
 * Fractions of that photo, so the placement means the same thing at any
 * display size: `x`/`y` are the design's centre, `width` its width.
 */
export interface DesignPlacement {
  x: number;
  y: number;
  width: number;
}

/**
 * The studio enforces the same range while dragging (PLACEMENT_WIDTH in the
 * frontend's lib/design-placement.ts). Keep the two equal.
 */
export const PLACEMENT_WIDTH = { min: 0.1, max: 0.9 } as const;

const PRECISION = 10_000;

const isFraction = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

/** Returns the placement rounded to a stable precision, or throws. */
export function normalizePlacement(
  placement: DesignPlacement,
): DesignPlacement {
  if (!isFraction(placement.x) || !isFraction(placement.y)) {
    throw new DomainError('The design must be placed on the garment');
  }
  if (
    !isFraction(placement.width) ||
    placement.width < PLACEMENT_WIDTH.min ||
    placement.width > PLACEMENT_WIDTH.max
  ) {
    throw new DomainError(
      `Design width must be between ${PLACEMENT_WIDTH.min} and ${PLACEMENT_WIDTH.max} of the garment`,
    );
  }

  const round = (value: number) => Math.round(value * PRECISION) / PRECISION;
  return {
    x: round(placement.x),
    y: round(placement.y),
    width: round(placement.width),
  };
}
