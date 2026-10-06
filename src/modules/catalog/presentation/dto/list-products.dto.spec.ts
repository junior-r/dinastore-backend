import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListProductsDto } from './list-products.dto';

describe('ListProductsDto', () => {
  it('defaults page to 1 and pageSize to 20 when omitted', () => {
    const dto = plainToInstance(ListProductsDto, {});

    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(20);
  });

  it('coerces query-string page/pageSize into numbers', () => {
    const dto = plainToInstance(ListProductsDto, { page: '3', pageSize: '50' });

    expect(dto.page).toBe(3);
    expect(dto.pageSize).toBe(50);
  });

  it('rejects a page below 1', async () => {
    const dto = plainToInstance(ListProductsDto, { page: '0' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  it('rejects a pageSize above 100', async () => {
    const dto = plainToInstance(ListProductsDto, { pageSize: '1000' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'pageSize')).toBe(true);
  });

  it('rejects a categoryIds entry that is not a UUID', async () => {
    const dto = plainToInstance(ListProductsDto, { categoryIds: 'not-a-uuid' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'categoryIds')).toBe(true);
  });

  it('parses a comma-separated categoryIds string into an array', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    const dto = plainToInstance(ListProductsDto, { categoryIds: `${a}, ${b}` });
    expect(dto.categoryIds).toEqual([a, b]);
  });

  it('rejects a status outside of the ProductStatus enum', async () => {
    const dto = plainToInstance(ListProductsDto, { status: 'NOT_A_STATUS' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'status')).toBe(true);
  });

  it('trims whitespace around search', () => {
    const dto = plainToInstance(ListProductsDto, { search: '  hoodie  ' });
    expect(dto.search).toBe('hoodie');
  });

  it('treats a blank search as omitted', () => {
    const dto = plainToInstance(ListProductsDto, { search: '   ' });
    expect(dto.search).toBeUndefined();
  });

  it('rejects a search longer than 100 characters', async () => {
    const dto = plainToInstance(ListProductsDto, { search: 'a'.repeat(101) });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'search')).toBe(true);
  });
});
