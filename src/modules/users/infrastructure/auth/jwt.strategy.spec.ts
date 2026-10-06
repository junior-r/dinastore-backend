import { ConfigService } from '@nestjs/config';
import { Role } from '@/modules/users/domain/entities/user.entity';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('returns the decoded payload unchanged from validate()', () => {
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    const strategy = new JwtStrategy(configService);

    const payload = {
      sub: 'user-1',
      email: 'jane@example.com',
      role: Role.CUSTOMER,
    };

    expect(strategy.validate(payload)).toBe(payload);
  });

  it('reads the secret from JWT_SECRET via ConfigService', () => {
    const getOrThrow = jest.fn().mockReturnValue('test-secret');
    const configService = { getOrThrow } as unknown as ConfigService;

    new JwtStrategy(configService);

    expect(getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
  });
});
