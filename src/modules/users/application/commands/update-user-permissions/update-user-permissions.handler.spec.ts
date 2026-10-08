import { NotFoundException } from '@nestjs/common';
import { DomainError } from '@/shared/domain/domain-error';
import { Permission } from '@/modules/users/domain/entities/permission';
import { Role, User } from '@/modules/users/domain/entities/user.entity';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { UpdateUserPermissionsCommand } from './update-user-permissions.command';
import { UpdateUserPermissionsHandler } from './update-user-permissions.handler';

function makeStaffUser(): User {
  return User.fromPersistence({
    id: 'staff-1',
    email: 'staff@example.com',
    passwordHash: 'hash',
    name: 'Staff Member',
    avatarUrl: null,
    role: Role.STAFF,
    isActive: true,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('UpdateUserPermissionsHandler', () => {
  let repository: jest.Mocked<UserRepository>;
  let handler: UpdateUserPermissionsHandler;

  beforeEach(() => {
    repository = createMockUserRepository();
    handler = new UpdateUserPermissionsHandler(repository);
  });

  it('replaces the permissions list', async () => {
    repository.findById.mockResolvedValue(makeStaffUser());
    repository.update.mockImplementation((user) => Promise.resolve(user));

    const result = await handler.execute(
      new UpdateUserPermissionsCommand('staff-1', [Permission.PRODUCTS_VIEW]),
    );

    expect(result.permissions).toEqual([Permission.PRODUCTS_VIEW]);
  });

  it('rejects an unknown permission string', async () => {
    await expect(
      handler.execute(
        new UpdateUserPermissionsCommand('staff-1', ['not-a-real-permission']),
      ),
    ).rejects.toThrow(DomainError);
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the target user does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      handler.execute(
        new UpdateUserPermissionsCommand('missing', [Permission.PRODUCTS_VIEW]),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
