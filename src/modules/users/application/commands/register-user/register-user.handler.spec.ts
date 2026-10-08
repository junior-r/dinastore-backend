import { ConflictException } from '@nestjs/common';
import type { EventBus } from '@nestjs/cqrs';
import { User } from '@/modules/users/domain/entities/user.entity';
import type { PasswordHasher } from '@/modules/users/domain/services/password-hasher';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { RegisterUserCommand } from './register-user.command';
import { RegisterUserHandler } from './register-user.handler';

describe('RegisterUserHandler', () => {
  let userRepository: jest.Mocked<UserRepository>;
  let passwordHasher: jest.Mocked<PasswordHasher>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: RegisterUserHandler;

  beforeEach(() => {
    userRepository = createMockUserRepository();
    passwordHasher = { hash: jest.fn(), compare: jest.fn() };
    eventBus = { publish: jest.fn() } as unknown as jest.Mocked<EventBus>;
    handler = new RegisterUserHandler(userRepository, passwordHasher, eventBus);
  });

  const command = new RegisterUserCommand(
    'Jane@Example.com',
    'supersecret123',
    'Jane Doe',
  );

  it('hashes the password and creates the user when the email is free', async () => {
    userRepository.emailExists.mockResolvedValue(false);
    passwordHasher.hash.mockResolvedValue('salt:hash');
    userRepository.create.mockImplementation((user) => Promise.resolve(user));

    const result = await handler.execute(command);

    expect(userRepository.emailExists).toHaveBeenCalledWith('jane@example.com');
    expect(passwordHasher.hash).toHaveBeenCalledWith('supersecret123');
    expect(result).toBeInstanceOf(User);
    expect(result.email).toBe('jane@example.com');
    expect(result.passwordHash).toBe('salt:hash');
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('throws ConflictException when the email is already registered', async () => {
    userRepository.emailExists.mockResolvedValue(true);

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(userRepository.create).not.toHaveBeenCalled();
  });
});
