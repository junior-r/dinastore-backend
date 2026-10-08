import { UnauthorizedException } from '@nestjs/common';
import { Role, User } from '@/modules/users/domain/entities/user.entity';
import type { PasswordHasher } from '@/modules/users/domain/services/password-hasher';
import type { TokenService } from '@/modules/users/domain/services/token-service';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { LoginUserCommand } from './login-user.command';
import { LoginUserHandler } from './login-user.handler';

describe('LoginUserHandler', () => {
  let userRepository: jest.Mocked<UserRepository>;
  let passwordHasher: jest.Mocked<PasswordHasher>;
  let tokenService: jest.Mocked<TokenService>;
  let handler: LoginUserHandler;

  const user = User.fromPersistence({
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'salt:hash',
    name: 'Jane Doe',
    avatarUrl: null,
    role: Role.CUSTOMER,
    isActive: true,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    userRepository = createMockUserRepository();
    passwordHasher = { hash: jest.fn(), compare: jest.fn() };
    tokenService = { sign: jest.fn() };
    handler = new LoginUserHandler(
      userRepository,
      passwordHasher,
      tokenService,
    );
  });

  it('returns an access token and the user when credentials are valid', async () => {
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(true);
    tokenService.sign.mockReturnValue('signed.jwt.token');

    const result = await handler.execute(
      new LoginUserCommand('Jane@Example.com', 'supersecret123'),
    );

    expect(userRepository.findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(passwordHasher.compare).toHaveBeenCalledWith(
      'supersecret123',
      'salt:hash',
    );
    expect(tokenService.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'jane@example.com',
      role: Role.CUSTOMER,
    });
    expect(result).toEqual({ accessToken: 'signed.jwt.token', user });
  });

  it('throws UnauthorizedException when the email is not registered', async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      handler.execute(new LoginUserCommand('missing@example.com', 'whatever1')),
    ).rejects.toThrow(UnauthorizedException);
    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for an OAuth-only account with no password hash', async () => {
    const oauthOnlyUser = User.fromPersistence({
      ...user.toPersistenceProps(),
      passwordHash: null,
    });
    userRepository.findByEmail.mockResolvedValue(oauthOnlyUser);

    await expect(
      handler.execute(new LoginUserCommand('jane@example.com', 'whatever123')),
    ).rejects.toThrow(UnauthorizedException);
    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the password does not match', async () => {
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      handler.execute(
        new LoginUserCommand('jane@example.com', 'wrong-password'),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(tokenService.sign).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for a deactivated account, even with the correct password', async () => {
    const deactivated = user.deactivate();
    userRepository.findByEmail.mockResolvedValue(deactivated);
    passwordHasher.compare.mockResolvedValue(true);

    await expect(
      handler.execute(
        new LoginUserCommand('jane@example.com', 'supersecret123'),
      ),
    ).rejects.toThrow('This account has been deactivated');
    expect(tokenService.sign).not.toHaveBeenCalled();
  });

  it('checks isActive only after the password is confirmed correct', async () => {
    const deactivated = user.deactivate();
    userRepository.findByEmail.mockResolvedValue(deactivated);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      handler.execute(
        new LoginUserCommand('jane@example.com', 'wrong-password'),
      ),
    ).rejects.toThrow('Invalid email or password');
  });

  it('gives the same error message for unknown email and wrong password', async () => {
    userRepository.findByEmail.mockResolvedValueOnce(null);
    const unknownEmailError = await handler
      .execute(new LoginUserCommand('missing@example.com', 'whatever1'))
      .catch((error: UnauthorizedException) => error.message);

    userRepository.findByEmail.mockResolvedValueOnce(user);
    passwordHasher.compare.mockResolvedValueOnce(false);
    const wrongPasswordError = await handler
      .execute(new LoginUserCommand('jane@example.com', 'wrong-password'))
      .catch((error: UnauthorizedException) => error.message);

    expect(unknownEmailError).toBe(wrongPasswordError);
  });
});
