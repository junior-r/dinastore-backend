import type { ProcessedImage } from '@/shared/domain/images/image-processor.port';
import type { DesignCrop } from '@/modules/customizations/domain/design-policy';

export const DESIGN_RENDERER = Symbol('DESIGN_RENDERER');

export interface RenderedDesign {
  /** Normalized upload, no logo. */
  source: ProcessedImage;
  /** Same pixels with the logo applied. Lossless. */
  print: ProcessedImage;
  /** Scaled-down copy of `print`. */
  thumbnail: ProcessedImage;
}

export interface DesignRenderer {
  /**
   * Produces the three files kept per design. Throws InvalidImageError if
   * `input` is not an image this renderer accepts. The logo's position comes
   * from `logoBox` in design-policy.
   *
   * With a `crop`, all three files hold only that part of the upload, and the
   * logo is placed relative to the cropped artwork.
   */
  render(
    input: Buffer,
    logo: Buffer,
    crop?: DesignCrop | null,
  ): Promise<RenderedDesign>;
}
