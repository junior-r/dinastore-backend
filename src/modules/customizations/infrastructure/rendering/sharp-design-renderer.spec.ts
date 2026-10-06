import sharp from 'sharp';
import { InvalidImageError } from '@/shared/domain/images/image-processor.port';
import { logoBox } from '@/modules/customizations/domain/design-policy';
import { SharpDesignRenderer } from './sharp-design-renderer';

const RED = { r: 255, g: 0, b: 0, alpha: 1 };
const BLUE = { r: 0, g: 0, b: 255, alpha: 1 };

function solid(width: number, height: number, background: typeof RED) {
  return sharp({ create: { width, height, channels: 4, background } })
    .png()
    .toBuffer();
}

async function pixelAt(image: Buffer, left: number, top: number) {
  const { data } = await sharp(image)
    .extract({ left, top, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
}

describe('SharpDesignRenderer', () => {
  const renderer = new SharpDesignRenderer();

  it('stamps the logo where the policy says, and nowhere else', async () => {
    const design = await solid(1000, 800, RED);
    const logo = await solid(400, 100, BLUE);

    const { source, print, thumbnail } = await renderer.render(design, logo);
    const box = logoBox(
      { width: 1000, height: 800 },
      { width: 400, height: 100 },
    );

    expect(print).toMatchObject({ width: 1000, height: 800, extension: 'png' });
    const centre = [
      box.left + Math.floor(box.width / 2),
      box.top + Math.floor(box.height / 2),
    ] as const;
    expect(await pixelAt(print.data, ...centre)).toEqual([0, 0, 255]);
    expect(await pixelAt(print.data, 10, 10)).toEqual([255, 0, 0]);
    // The kept source is the same artwork with no logo on it.
    expect(await pixelAt(source.data, ...centre)).toEqual([255, 0, 0]);

    expect(thumbnail.extension).toBe('webp');
    expect(thumbnail.width).toBe(800);
    expect(thumbnail.height).toBe(640);
  });

  it('keeps only the cropped part, measured on the image as displayed', async () => {
    // Stored 1200x600 with the left half red and the right half blue, tagged
    // as taken sideways: it displays as 600x1200, red on top, blue below.
    const left = await solid(600, 600, RED);
    const sideways = await sharp({
      create: { width: 1200, height: 600, channels: 3, background: BLUE },
    })
      .composite([{ input: left, left: 0, top: 0 }])
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const logo = await solid(40, 10, RED);

    const { source, print } = await renderer.render(sideways, logo, {
      x: 0,
      y: 0.5,
      width: 1,
      height: 0.5,
    });

    expect(source).toMatchObject({ width: 600, height: 600 });
    expect(print).toMatchObject({ width: 600, height: 600 });
    const [r, , b] = await pixelAt(source.data, 300, 50);
    expect(r).toBeLessThan(10);
    expect(b).toBeGreaterThan(245);
  });

  it('refuses a crop that leaves the image', async () => {
    const design = await solid(1000, 800, RED);
    const logo = await solid(400, 100, BLUE);

    await expect(
      renderer.render(design, logo, { x: 0.8, y: 0, width: 0.5, height: 1 }),
    ).rejects.toThrow('The crop area must lie inside the image');
  });

  it('scales oversized artwork down to the print limit', async () => {
    const design = await solid(5000, 2500, RED);
    const logo = await solid(400, 100, BLUE);

    const { print } = await renderer.render(design, logo);

    expect(print.width).toBe(4000);
    expect(print.height).toBe(2000);
  });

  it('rejects a file that is not an accepted image', async () => {
    const logo = await solid(400, 100, BLUE);
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"/>',
    );

    await expect(
      renderer.render(Buffer.from('not an image'), logo),
    ).rejects.toThrow(InvalidImageError);
    await expect(renderer.render(svg, logo)).rejects.toThrow(InvalidImageError);
  });
});
