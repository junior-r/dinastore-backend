import { DomainError } from '@/shared/domain/domain-error';
import { LOGO_RULE, cropRegion, logoBox } from './design-policy';

describe('logoBox', () => {
  const logo = { width: 720, height: 180 };

  it('sizes the logo as a share of the design width, keeping its shape', () => {
    const box = logoBox({ width: 2000, height: 2000 }, logo);

    expect(box.width).toBe(2000 * LOGO_RULE.widthRatio);
    expect(box.width / box.height).toBeCloseTo(4);
  });

  it('puts it in the bottom-right corner, inset by the margin', () => {
    const box = logoBox({ width: 2000, height: 2000 }, logo);
    const margin = 2000 * LOGO_RULE.marginRatio;

    expect(box.left + box.width).toBe(2000 - margin);
    expect(box.top + box.height).toBe(2000 - margin);
  });

  it('caps the logo by height on a very wide design', () => {
    const box = logoBox({ width: 4000, height: 400 }, logo);

    expect(box.height).toBe(400 * LOGO_RULE.maxHeightRatio);
    expect(box.width).toBe(400);
  });

  it('never places the logo outside the design', () => {
    for (const design of [
      { width: 500, height: 40 },
      { width: 40, height: 500 },
      { width: 4000, height: 4000 },
    ]) {
      const box = logoBox(design, logo);

      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.left + box.width).toBeLessThanOrEqual(design.width);
      expect(box.top + box.height).toBeLessThanOrEqual(design.height);
    }
  });
});

describe('cropRegion', () => {
  const image = { width: 2000, height: 1000 };

  it('turns fractions into a pixel region', () => {
    expect(
      cropRegion(image, { x: 0.25, y: 0.1, width: 0.5, height: 0.8 }),
    ).toEqual({ left: 500, top: 100, width: 1000, height: 800 });
  });

  it('accepts the whole image, including float error at the far edge', () => {
    expect(cropRegion(image, { x: 0, y: 0, width: 1, height: 1 })).toEqual({
      left: 0,
      top: 0,
      width: 2000,
      height: 1000,
    });
    const region = cropRegion(image, {
      x: 0.3,
      y: 0.1,
      width: 0.7,
      height: 0.9,
    });
    expect(region.left + region.width).toBe(2000);
    expect(region.top + region.height).toBe(1000);
  });

  it.each([
    { x: 0.6, y: 0, width: 0.5, height: 1 },
    { x: 0, y: 0, width: 0, height: 1 },
    { x: -0.1, y: 0, width: 0.5, height: 1 },
    { x: 0, y: 0, width: Number.NaN, height: 1 },
  ])('refuses a crop outside the image: %o', (crop) => {
    expect(() => cropRegion(image, crop)).toThrow(DomainError);
  });
});
