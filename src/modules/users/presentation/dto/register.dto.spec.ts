import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

async function validatePlain(payload: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, payload);
  return validate(dto);
}

describe('RegisterDto', () => {
  const validPayload = {
    email: 'jane@example.com',
    password: 'supersecret123',
    name: 'Jane Doe',
  };

  it('accepts a well-formed payload', async () => {
    const errors = await validatePlain(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validatePlain({
      ...validPayload,
      email: 'not-an-email',
    });
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    const errors = await validatePlain({ ...validPayload, password: 'short1' });
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });

  it('rejects a whitespace-only name', async () => {
    const errors = await validatePlain({ ...validPayload, name: '   ' });
    expect(errors.some((error) => error.property === 'name')).toBe(true);
  });
});
