import { NotFoundException } from '@nestjs/common';
import { Role, User } from '@/modules/users/domain/entities/user.entity';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { ActivateUserCommand } from './activate-user.command';
import { ActivateUserHandler } from './activate-user.handler';

function makeDeactivatedUser(): User {
  return User.fromPersistence({
    id: 'target-1',
    email: 'target@example.com',
    passwordHash: 'hash',
    name: 'Target User',
    avatarUrl: null,
    role: Role.CUSTOMER,
    isActive: false,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('ActivateUserHandler', () => {
  let repository: jest.Mocked<UserRepository>;
  let handler: ActivateUserHandler;

  beforeEach(() => {
    repository = createMockUserRepository();
    handler = new ActivateUserHandler(repository);
  });

  it('reactivates the target user', async () => {
    repository.findById.mockResolvedValue(makeDeactivatedUser());
    repository.update.mockImplementation((user) => Promise.resolve(user));

    const result = await handler.execute(new ActivateUserCommand('target-1'));

    expect(result.isActive).toBe(true);
  });

  it('throws NotFoundException when the target user does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new ActivateUserCommand('missing')),
    ).rejects.toThrow(NotFoundException);
  });
});
