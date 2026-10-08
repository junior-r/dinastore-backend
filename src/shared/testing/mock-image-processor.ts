import type {
  ImageProcessor,
  ImageVariantSpec,
} from '../domain/images/image-processor.port';

export function createMockImageProcessor(): jest.Mocked<ImageProcessor> {
  return {
    optimize: jest.fn((_input: Buffer, variants: ImageVariantSpec[]) =>
      Promise.resolve(
        variants.map((variant) => ({
          data: Buffer.from(`optimized-${variant.maxWidth}`),
          contentType: 'image/webp',
          extension: 'webp',
          width: variant.maxWidth,
          height: variant.maxHeight,
        })),
      ),
    ),
  };
}
