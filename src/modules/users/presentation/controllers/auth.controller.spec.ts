import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { LoginUserCommand } from '@/modules/users/application/commands/login-user/login-user.command';
import { RegisterUserCommand } from '@/modules/users/application/commands/register-user/register-user.command';
import { GetUserByIdQuery } from '@/modules/users/application/queries/get-user-by-id/get-user-by-id.query';
import { Role, User } from '@/modules/users/domain/entities/user.entity';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };

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

  beforeEach(async () => {
    commandBus = { execute: jest.fn() };
    queryBus = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: CommandBus, useValue: commandBus },
        { provide: QueryBus, useValue: queryBus },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  it('register() dispatches RegisterUserCommand and hides the password hash', async () => {
    commandBus.execute.mockResolvedValue(user);

    const result = await controller.register({
      email: 'jane@example.com',
      password: 'supersecret123',
      name: 'Jane Doe',
    });

    expect(commandBus.execute).toHaveBeenCalledWith(
      new RegisterUserCommand('jane@example.com', 'supersecret123', 'Jane Doe'),
    );
    expect(result).toEqual(
      expect.objectContaining({ id: 'user-1', email: 'jane@example.com' }),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('login() dispatches LoginUserCommand and returns the access token with the user', async () => {
    commandBus.execute.mockResolvedValue({
      accessToken: 'signed.jwt.token',
      user,
    });

    const result = await controller.login({
      email: 'jane@example.com',
      password: 'supersecret123',
    });

    expect(commandBus.execute).toHaveBeenCalledWith(
      new LoginUserCommand('jane@example.com', 'supersecret123'),
    );
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user).toEqual(expect.objectContaining({ id: 'user-1' }));
  });

  it('me() dispatches GetUserByIdQuery using the authenticated user id', async () => {
    queryBus.execute.mockResolvedValue(user);

    const result = await controller.me({
      sub: 'user-1',
      email: 'jane@example.com',
      role: Role.CUSTOMER,
    });

    expect(queryBus.execute).toHaveBeenCalledWith(
      new GetUserByIdQuery('user-1'),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'user-1' }));
  });
});
