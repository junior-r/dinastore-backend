import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';

async function validatePlain(payload: Record<string, unknown>) {
  const dto = plainToInstance(LoginDto, payload);
  return validate(dto);
}

describe('LoginDto', () => {
  it('accepts a well-formed payload', async () => {
    const errors = await validatePlain({
      email: 'jane@example.com',
      password: 'anything',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const errors = await validatePlain({
      email: 'not-an-email',
      password: 'anything',
    });
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('rejects an empty password', async () => {
    const errors = await validatePlain({
      email: 'jane@example.com',
      password: '',
    });
    expect(errors.some((error) => error.property === 'password')).toBe(true);
  });
});
