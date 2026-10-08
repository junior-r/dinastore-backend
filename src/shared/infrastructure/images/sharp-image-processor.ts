import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { InvalidImageError } from '@/shared/domain/images/image-processor.port';
import type {
  ImageProcessor,
  ImageVariantSpec,
  ProcessedImage,
} from '@/shared/domain/images/image-processor.port';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

// Decoded-size ceiling. A few-KB file can declare enormous dimensions (a
// "decompression bomb"); this makes sharp refuse it before allocating.
const MAX_INPUT_PIXELS = 50_000_000;

@Injectable()
export class SharpImageProcessor implements ImageProcessor {
  async optimize(
    input: Buffer,
    variants: ImageVariantSpec[],
  ): Promise<ProcessedImage[]> {
    try {
      const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });

      // The format comes from the file's own bytes, not the client's claimed
      // Content-Type, so a renamed .exe or an SVG with scripts never gets in.
      const { format } = await source.metadata();
      if (!format || !ACCEPTED_FORMATS.has(format)) {
        throw new InvalidImageError(
          'Only PNG, JPEG, and WebP images are allowed',
        );
      }

      return await Promise.all(
        variants.map(async (variant) => {
          const { data, info } = await source
            .clone()
            // Bake the EXIF orientation into the pixels. Metadata is dropped
            // on output (sharp's default), which is what strips GPS
            // coordinates and camera details from phone photos — without this
            // step that would also leave them sideways.
            .rotate()
            .resize({
              width: variant.maxWidth,
              height: variant.maxHeight,
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: variant.quality })
            .toBuffer({ resolveWithObject: true });

          return {
            data,
            contentType: 'image/webp',
            extension: 'webp',
            width: info.width,
            height: info.height,
          };
        }),
      );
    } catch (error) {
      if (error instanceof InvalidImageError) throw error;
      // Truncated/corrupt data, an unsupported codec, or the pixel limit.
      throw new InvalidImageError();
    }
  }
}
