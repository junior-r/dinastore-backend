import { UnauthorizedException } from '@nestjs/common';
import type { EventBus } from '@nestjs/cqrs';
import {
  OAuthProvider,
  Role,
  User,
} from '@/modules/users/domain/entities/user.entity';
import type { TokenService } from '@/modules/users/domain/services/token-service';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { OAuthLoginCommand } from './oauth-login.command';
import { OAuthLoginHandler } from './oauth-login.handler';

describe('OAuthLoginHandler', () => {
  let userRepository: jest.Mocked<UserRepository>;
  let tokenService: jest.Mocked<TokenService>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: OAuthLoginHandler;

  const existingUser = User.fromPersistence({
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: null,
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
    tokenService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    eventBus = { publish: jest.fn() } as unknown as jest.Mocked<EventBus>;
    handler = new OAuthLoginHandler(userRepository, tokenService, eventBus);
  });

  it('signs in directly when the provider account is already linked, backfilling a missing avatar', async () => {
    userRepository.findByProviderAccount.mockResolvedValue(existingUser);

    const result = await handler.execute(
      new OAuthLoginCommand(
        OAuthProvider.GOOGLE,
        'google-sub-1',
        'jane@example.com',
        'Jane Doe',
        'https://example.com/photo.jpg',
      ),
    );

    expect(userRepository.findByProviderAccount).toHaveBeenCalledWith(
      OAuthProvider.GOOGLE,
      'google-sub-1',
    );
    expect(userRepository.setAvatarUrlIfMissing).toHaveBeenCalledWith(
      'user-1',
      'https://example.com/photo.jpg',
    );
    expect(userRepository.findByEmail).not.toHaveBeenCalled();
    expect(userRepository.linkOAuthAccount).not.toHaveBeenCalled();
    expect(userRepository.createFromOAuth).not.toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      user: existingUser,
    });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('links the provider (and its avatar) to an existing user found by email', async () => {
    userRepository.findByProviderAccount.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(existingUser);

    const result = await handler.execute(
      new OAuthLoginCommand(
        OAuthProvider.GOOGLE,
        'google-sub-1',
        'Jane@Example.com',
        'Jane Doe',
        'https://example.com/photo.jpg',
      ),
    );

    expect(userRepository.findByEmail).toHaveBeenCalledWith('jane@example.com');
    expect(userRepository.linkOAuthAccount).toHaveBeenCalledWith(
      'user-1',
      OAuthProvider.GOOGLE,
      'google-sub-1',
    );
    expect(userRepository.setAvatarUrlIfMissing).toHaveBeenCalledWith(
      'user-1',
      'https://example.com/photo.jpg',
    );
    expect(userRepository.createFromOAuth).not.toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      user: existingUser,
    });
  });

  it('creates a brand-new user (with the provider avatar) when neither the provider account nor the email exist', async () => {
    userRepository.findByProviderAccount.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createFromOAuth.mockImplementation((user) =>
      Promise.resolve(user),
    );

    const result = await handler.execute(
      new OAuthLoginCommand(
        OAuthProvider.GOOGLE,
        'google-sub-2',
        'new@example.com',
        'New Person',
        'https://example.com/new-photo.jpg',
      ),
    );

    expect(userRepository.createFromOAuth).toHaveBeenCalledWith(
      expect.any(User),
      OAuthProvider.GOOGLE,
      'google-sub-2',
    );
    expect(result.user.email).toBe('new@example.com');
    expect(result.user.passwordHash).toBeNull();
    expect(result.user.avatarUrl).toBe('https://example.com/new-photo.jpg');
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('rejects sign-in for a deactivated account, even when the provider account is already linked', async () => {
    userRepository.findByProviderAccount.mockResolvedValue(
      existingUser.deactivate(),
    );

    await expect(
      handler.execute(
        new OAuthLoginCommand(
          OAuthProvider.GOOGLE,
          'google-sub-1',
          'jane@example.com',
          'Jane Doe',
          null,
        ),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects sign-in for a deactivated account found by email (link-by-email branch)', async () => {
    userRepository.findByProviderAccount.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(existingUser.deactivate());

    await expect(
      handler.execute(
        new OAuthLoginCommand(
          OAuthProvider.GOOGLE,
          'google-sub-1',
          'jane@example.com',
          'Jane Doe',
          null,
        ),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('creates a brand-new user with no avatar when the provider has none', async () => {
    userRepository.findByProviderAccount.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.createFromOAuth.mockImplementation((user) =>
      Promise.resolve(user),
    );

    const result = await handler.execute(
      new OAuthLoginCommand(
        OAuthProvider.GOOGLE,
        'google-sub-3',
        'no-photo@example.com',
        'No Photo',
        null,
      ),
    );

    expect(result.user.avatarUrl).toBeNull();
  });
});
