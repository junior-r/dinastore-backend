import { DomainError } from '../domain-error';

export const IMAGE_PROCESSOR = Symbol('IMAGE_PROCESSOR');

export interface ImageVariantSpec {
  /** Bounding box — the image is scaled down to fit, never up, never cropped. */
  maxWidth: number;
  maxHeight: number;
  /** 1..100 */
  quality: number;
}

export interface ProcessedImage {
  data: Buffer;
  contentType: string;
  /** Without the dot, e.g. `webp`. */
  extension: string;
  width: number;
  height: number;
}

/** A DomainError so an unusable upload surfaces as a 400, not a 500. */
export class InvalidImageError extends DomainError {
  constructor(message = 'The uploaded file is not a supported image') {
    super(message);
    this.name = 'InvalidImageError';
  }
}

export interface ImageProcessor {
  /**
   * Decodes `input` once and re-encodes it at each requested size, returned
   * in the same order as `variants`. Throws InvalidImageError if the bytes
   * are not an image this processor accepts — the caller's claimed MIME type
   * is never consulted.
   */
  optimize(
    input: Buffer,
    variants: ImageVariantSpec[],
  ): Promise<ProcessedImage[]>;
}
