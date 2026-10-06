import { DomainError } from '@/shared/domain/domain-error';

/** Largest upload accepted for a design, before any processing. */
export const MAX_DESIGN_BYTES = 15 * 1024 * 1024;

/** What the studio's file picker offers. The server decides from the bytes. */
export const ACCEPTED_DESIGN_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Storage key prefix every design file lives under. */
export const DESIGN_KEY_PREFIX = 'designs';

/**
 * Artwork whose longest side is below this prints visibly blurry at any
 * useful size, so it is refused instead of producing a bad garment.
 */
export const MIN_DESIGN_EDGE_PX = 500;

/** The print file is scaled down to fit this box, never up. */
export const PRINT_MAX_EDGE_PX = 4000;

/** The preview shown in the cart, on orders and in the admin list. */
export const THUMBNAIL_MAX_EDGE_PX = 800;

/**
 * Where the mandatory store logo goes on a design: bottom-right corner, a
 * fixed share of the design's width, capped by height so a very wide design
 * doesn't get a logo taller than itself. The studio previews the logo with
 * these same numbers (served by GET /customizations/config), so what the
 * shopper sees is what gets printed.
 */
export const LOGO_RULE = {
  widthRatio: 0.22,
  maxHeightRatio: 0.25,
  /** Gap from the corner, as a share of the design's shorter side. */
  marginRatio: 0.03,
} as const;

export interface Size {
  width: number;
  height: number;
}

export interface Box extends Size {
  left: number;
  top: number;
}

/** The logo's position and size, in pixels, on a design of the given size. */
export function logoBox(design: Size, logo: Size): Box {
  const aspect = logo.width / logo.height;

  let width = design.width * LOGO_RULE.widthRatio;
  let height = width / aspect;
  const maxHeight = design.height * LOGO_RULE.maxHeightRatio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }

  const margin = Math.min(design.width, design.height) * LOGO_RULE.marginRatio;

  const box = {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
  return {
    ...box,
    left: Math.max(0, Math.round(design.width - box.width - margin)),
    top: Math.max(0, Math.round(design.height - box.height - margin)),
  };
}

/**
 * The part of an upload to keep, chosen by the shopper in the studio's crop
 * tool. Fractions of the image as it is displayed (after its EXIF orientation
 * is applied), so the same four numbers mean the same rectangle in the
 * browser's preview and here, whatever each side's pixel size is.
 */
export interface DesignCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Slack for a rectangle dragged flush against an edge: 0.3 + 0.7 is not
// exactly 1 in floating point.
const CROP_TOLERANCE = 1e-6;

const isFraction = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1;

/** The crop as a pixel region of an image of the given size, or throws. */
export function cropRegion(image: Size, crop: DesignCrop): Box {
  const inside =
    isFraction(crop.x) &&
    isFraction(crop.y) &&
    isFraction(crop.width) &&
    isFraction(crop.height) &&
    crop.width > 0 &&
    crop.height > 0 &&
    crop.x + crop.width <= 1 + CROP_TOLERANCE &&
    crop.y + crop.height <= 1 + CROP_TOLERANCE;
  if (!inside) {
    throw new DomainError('The crop area must lie inside the image');
  }

  const left = Math.min(image.width - 1, Math.round(crop.x * image.width));
  const top = Math.min(image.height - 1, Math.round(crop.y * image.height));
  return {
    left,
    top,
    width: Math.max(
      1,
      Math.min(image.width - left, Math.round(crop.width * image.width)),
    ),
    height: Math.max(
      1,
      Math.min(image.height - top, Math.round(crop.height * image.height)),
    ),
  };
}
