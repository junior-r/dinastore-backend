import { NotFoundException } from '@nestjs/common';
import { Role, User } from '@/modules/users/domain/entities/user.entity';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { GetUserByIdHandler } from './get-user-by-id.handler';
import { GetUserByIdQuery } from './get-user-by-id.query';

describe('GetUserByIdHandler', () => {
  let userRepository: jest.Mocked<UserRepository>;
  let handler: GetUserByIdHandler;

  beforeEach(() => {
    userRepository = createMockUserRepository();
    handler = new GetUserByIdHandler(userRepository);
  });

  it('returns the user when found', async () => {
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
    userRepository.findById.mockResolvedValue(user);

    const result = await handler.execute(new GetUserByIdQuery('user-1'));

    expect(userRepository.findById).toHaveBeenCalledWith('user-1');
    expect(result).toBe(user);
  });

  it('throws NotFoundException when no user matches the id', async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetUserByIdQuery('missing')),
    ).rejects.toThrow(NotFoundException);
  });
});
