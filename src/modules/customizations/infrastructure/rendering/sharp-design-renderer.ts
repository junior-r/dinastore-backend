import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { DomainError } from '@/shared/domain/domain-error';
import { InvalidImageError } from '@/shared/domain/images/image-processor.port';
import type { ProcessedImage } from '@/shared/domain/images/image-processor.port';
import {
  PRINT_MAX_EDGE_PX,
  THUMBNAIL_MAX_EDGE_PX,
  cropRegion,
  logoBox,
} from '@/modules/customizations/domain/design-policy';
import type { DesignCrop } from '@/modules/customizations/domain/design-policy';
import type {
  DesignRenderer,
  RenderedDesign,
} from '@/modules/customizations/domain/ports/design-renderer.port';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);

// Decoded-size ceiling, same reasoning as SharpImageProcessor: a tiny file
// can declare enormous dimensions. Higher here because print artwork is
// legitimately large.
const MAX_INPUT_PIXELS = 100_000_000;

const THUMBNAIL_QUALITY = 82;

function png(result: { data: Buffer; info: sharp.OutputInfo }): ProcessedImage {
  return {
    data: result.data,
    contentType: 'image/png',
    extension: 'png',
    width: result.info.width,
    height: result.info.height,
  };
}

@Injectable()
export class SharpDesignRenderer implements DesignRenderer {
  async render(
    input: Buffer,
    logo: Buffer,
    crop: DesignCrop | null = null,
  ): Promise<RenderedDesign> {
    try {
      const upload = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });

      // From the file's own bytes, never the client's claimed Content-Type.
      const { format, autoOrient } = await upload.metadata();
      if (!format || !ACCEPTED_FORMATS.has(format)) {
        throw new InvalidImageError(
          'Only PNG, JPEG, and WebP images are allowed',
        );
      }

      // PNG throughout: lossless, and it keeps the transparency most artwork
      // made for printing relies on. `rotate()` bakes in the EXIF orientation
      // before the metadata is dropped.
      // `rotate()` is applied before `extract()` whatever order they are
      // called in, so the region is measured on the image as displayed.
      // `autoOrient` is that image's size (width and height swapped for a
      // photo taken sideways).
      const oriented = upload.rotate();
      const framed = crop
        ? oriented.extract(cropRegion(autoOrient, crop))
        : oriented;

      const source = png(
        await framed
          .resize({
            width: PRINT_MAX_EDGE_PX,
            height: PRINT_MAX_EDGE_PX,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .png()
          .toBuffer({ resolveWithObject: true }),
      );

      const logoMeta = await sharp(logo).metadata();
      const box = logoBox(source, {
        width: logoMeta.width,
        height: logoMeta.height,
      });
      const stamp = await sharp(logo)
        .resize({ width: box.width, height: box.height, fit: 'fill' })
        .png()
        .toBuffer();

      const print = png(
        await sharp(source.data)
          .composite([{ input: stamp, left: box.left, top: box.top }])
          .png()
          .toBuffer({ resolveWithObject: true }),
      );

      const thumbnail = await sharp(print.data)
        .resize({
          width: THUMBNAIL_MAX_EDGE_PX,
          height: THUMBNAIL_MAX_EDGE_PX,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: THUMBNAIL_QUALITY })
        .toBuffer({ resolveWithObject: true });

      return {
        source,
        print,
        thumbnail: {
          data: thumbnail.data,
          contentType: 'image/webp',
          extension: 'webp',
          width: thumbnail.info.width,
          height: thumbnail.info.height,
        },
      };
    } catch (error) {
      // InvalidImageError extends DomainError; a refused crop is one too.
      if (error instanceof DomainError) throw error;
      // Truncated/corrupt data, an unsupported codec, or the pixel limit.
      throw new InvalidImageError();
    }
  }
}
