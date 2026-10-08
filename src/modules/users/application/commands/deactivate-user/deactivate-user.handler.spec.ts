import { NotFoundException } from '@nestjs/common';
import type { EventBus } from '@nestjs/cqrs';
import { DomainError } from '@/shared/domain/domain-error';
import { Role, User } from '@/modules/users/domain/entities/user.entity';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { DeactivateUserCommand } from './deactivate-user.command';
import { DeactivateUserHandler } from './deactivate-user.handler';

function makeUser(): User {
  return User.fromPersistence({
    id: 'target-1',
    email: 'target@example.com',
    passwordHash: 'hash',
    name: 'Target User',
    avatarUrl: null,
    role: Role.CUSTOMER,
    isActive: true,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('DeactivateUserHandler', () => {
  let repository: jest.Mocked<UserRepository>;
  let eventBus: jest.Mocked<EventBus>;
  let handler: DeactivateUserHandler;

  beforeEach(() => {
    repository = createMockUserRepository();
    eventBus = { publish: jest.fn() } as unknown as jest.Mocked<EventBus>;
    handler = new DeactivateUserHandler(repository, eventBus);
  });

  it('deactivates the target user', async () => {
    repository.findById.mockResolvedValue(makeUser());
    repository.update.mockImplementation((user) => Promise.resolve(user));

    const result = await handler.execute(
      new DeactivateUserCommand('admin-1', 'target-1'),
    );

    expect(result.isActive).toBe(false);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('rejects deactivating your own account', async () => {
    await expect(
      handler.execute(new DeactivateUserCommand('admin-1', 'admin-1')),
    ).rejects.toThrow(DomainError);
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the target user does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new DeactivateUserCommand('admin-1', 'missing')),
    ).rejects.toThrow(NotFoundException);
  });
});
