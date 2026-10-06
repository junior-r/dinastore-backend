import { NotFoundException } from '@nestjs/common';
import { DomainError } from '@/shared/domain/domain-error';
import { Role, User } from '@/modules/users/domain/entities/user.entity';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { UpdateUserRoleCommand } from './update-user-role.command';
import { UpdateUserRoleHandler } from './update-user-role.handler';

function makeUser(role: Role): User {
  return User.fromPersistence({
    id: 'target-1',
    email: 'target@example.com',
    passwordHash: 'hash',
    name: 'Target User',
    avatarUrl: null,
    role,
    isActive: true,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('UpdateUserRoleHandler', () => {
  let repository: jest.Mocked<UserRepository>;
  let handler: UpdateUserRoleHandler;

  beforeEach(() => {
    repository = createMockUserRepository();
    handler = new UpdateUserRoleHandler(repository);
  });

  it('updates the target user to the new role', async () => {
    repository.findById.mockResolvedValue(makeUser(Role.CUSTOMER));
    repository.update.mockImplementation((user) => Promise.resolve(user));

    const result = await handler.execute(
      new UpdateUserRoleCommand('admin-1', 'target-1', Role.STAFF),
    );

    expect(result.role).toBe(Role.STAFF);
    expect(repository.update).toHaveBeenCalledWith(expect.any(User));
  });

  it('rejects an admin changing their own role', async () => {
    await expect(
      handler.execute(
        new UpdateUserRoleCommand('admin-1', 'admin-1', Role.CUSTOMER),
      ),
    ).rejects.toThrow(DomainError);
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the target user does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new UpdateUserRoleCommand('admin-1', 'missing', Role.STAFF),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
