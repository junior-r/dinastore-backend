import sharp from 'sharp';
import { InvalidImageError } from '@/shared/domain/images/image-processor.port';
import { SharpImageProcessor } from './sharp-image-processor';

// Real sharp, no mocks: this adapter *is* the integration with it, and it
// runs in-process on generated buffers (no network, no Docker).
describe('SharpImageProcessor', () => {
  const processor = new SharpImageProcessor();

  const solid = (width: number, height: number) =>
    sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 200, g: 40, b: 40 },
      },
    });

  const full = { maxWidth: 1600, maxHeight: 1600, quality: 80 };
  const thumbnail = { maxWidth: 480, maxHeight: 480, quality: 72 };

  it('re-encodes to WebP and scales each variant down to fit, keeping aspect ratio', async () => {
    const input = await solid(3200, 1600).jpeg().toBuffer();

    const [large, small] = await processor.optimize(input, [full, thumbnail]);

    expect(large).toMatchObject({
      contentType: 'image/webp',
      extension: 'webp',
      width: 1600,
      height: 800,
    });
    expect(small).toMatchObject({ width: 480, height: 240 });

    const decoded = await sharp(large.data).metadata();
    expect(decoded).toMatchObject({ format: 'webp', width: 1600, height: 800 });
  });

  it('never enlarges an image smaller than the bounding box', async () => {
    const input = await solid(100, 50).png().toBuffer();

    const [large, small] = await processor.optimize(input, [full, thumbnail]);

    expect(large).toMatchObject({ width: 100, height: 50 });
    expect(small).toMatchObject({ width: 100, height: 50 });
  });

  it('bakes in the EXIF orientation and strips the metadata', async () => {
    // Orientation 6 = "rotate 90deg to display": stored 400x200, shown 200x400.
    const input = await solid(400, 200)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({ IFD0: { Copyright: 'someone' } })
      .toBuffer();
    const original = await sharp(input).metadata();
    expect(original.orientation).toBe(6);
    expect(original.exif).toBeDefined();

    const [large] = await processor.optimize(input, [full]);

    expect(large).toMatchObject({ width: 200, height: 400 });
    const decoded = await sharp(large.data).metadata();
    expect(decoded.exif).toBeUndefined();
    expect(decoded.orientation).toBeUndefined();
  });

  it('rejects bytes that are not an image', async () => {
    await expect(
      processor.optimize(Buffer.from('definitely not an image'), [full]),
    ).rejects.toThrow(InvalidImageError);
  });

  it('rejects a real image in a format that is not accepted', async () => {
    const gif = await solid(10, 10).gif().toBuffer();
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );

    await expect(processor.optimize(gif, [full])).rejects.toThrow(
      'Only PNG, JPEG, and WebP images are allowed',
    );
    await expect(processor.optimize(svg, [full])).rejects.toThrow(
      InvalidImageError,
    );
  });

  it('rejects a truncated file', async () => {
    const input = await solid(800, 800).jpeg().toBuffer();

    await expect(
      processor.optimize(input.subarray(0, 200), [full]),
    ).rejects.toThrow(InvalidImageError);
  });
});
