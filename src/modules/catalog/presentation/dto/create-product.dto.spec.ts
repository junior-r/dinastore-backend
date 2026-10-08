import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

async function validatePlain(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateProductDto, payload);
  return validate(dto);
}

describe('CreateProductDto', () => {
  const validPayload = {
    name: 'Classic Tee',
    slug: 'classic-tee',
    basePriceCents: 2500,
    currency: 'USD',
    categoryIds: ['123e4567-e89b-42d3-a456-426614174000'],
  };

  it('accepts a well-formed payload', async () => {
    const errors = await validatePlain(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('rejects a blank name', async () => {
    const errors = await validatePlain({ ...validPayload, name: '   ' });
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });

  it('rejects a slug with uppercase letters or spaces', async () => {
    const errors = await validatePlain({
      ...validPayload,
      slug: 'Classic Tee',
    });
    expect(errors.some((error) => error.property === 'slug')).toBe(true);
  });

  it('rejects a categoryIds entry that is not a UUID', async () => {
    const errors = await validatePlain({
      ...validPayload,
      categoryIds: ['category-1'],
    });
    expect(errors.some((error) => error.property === 'categoryIds')).toBe(true);
  });

  it('rejects an empty categoryIds array', async () => {
    const errors = await validatePlain({ ...validPayload, categoryIds: [] });
    expect(errors.some((error) => error.property === 'categoryIds')).toBe(true);
  });

  it('rejects a currency code that is not exactly 3 characters', async () => {
    const errors = await validatePlain({ ...validPayload, currency: 'US' });
    expect(errors.some((error) => error.property === 'currency')).toBe(true);
  });

  it('rejects a negative basePriceCents', async () => {
    const errors = await validatePlain({ ...validPayload, basePriceCents: -1 });
    expect(errors.some((error) => error.property === 'basePriceCents')).toBe(
      true,
    );
  });

  it('rejects a variant with a blank sku', async () => {
    const errors = await validatePlain({
      ...validPayload,
      variants: [{ size: 'M', color: 'black', sku: '', stock: 1 }],
    });
    expect(errors.some((error) => error.property === 'variants')).toBe(true);
  });
});
