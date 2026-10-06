import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@/modules/users/domain/entities/permission';
import { Role, User } from '@/modules/users/domain/entities/user.entity';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { PermissionsGuard } from './permissions.guard';

function makeContext(user?: { sub: string; role: Role }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function makeStaffUser(
  overrides: { isActive?: boolean; permissions?: string[] } = {},
): User {
  return User.fromPersistence({
    id: 'staff-1',
    email: 'staff@example.com',
    passwordHash: 'hash',
    name: 'Staff Member',
    avatarUrl: null,
    role: Role.STAFF,
    isActive: overrides.isActive ?? true,
    permissions: overrides.permissions ?? [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('PermissionsGuard', () => {
  let userRepository: jest.Mocked<UserRepository>;
  let guard: PermissionsGuard;
  let reflector: Reflector;

  function setUp(requiredPermission: Permission | undefined) {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredPermission),
    } as unknown as Reflector;
    userRepository = createMockUserRepository();
    guard = new PermissionsGuard(reflector, userRepository);
  }

  it('allows the request when no @RequirePermission metadata is present', async () => {
    setUp(undefined);

    await expect(
      guard.canActivate(makeContext({ sub: 'x', role: Role.STAFF })),
    ).resolves.toBe(true);
  });

  it('blocks a request with no authenticated user', async () => {
    setUp(Permission.PRODUCTS_VIEW);

    await expect(guard.canActivate(makeContext(undefined))).resolves.toBe(
      false,
    );
  });

  it('always allows ADMIN, without looking up the user', async () => {
    setUp(Permission.USERS_MANAGE);

    await expect(
      guard.canActivate(makeContext({ sub: 'admin-1', role: Role.ADMIN })),
    ).resolves.toBe(true);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('allows STAFF who has the required permission', async () => {
    setUp(Permission.PRODUCTS_VIEW);
    userRepository.findById.mockResolvedValue(
      makeStaffUser({ permissions: [Permission.PRODUCTS_VIEW] }),
    );

    await expect(
      guard.canActivate(makeContext({ sub: 'staff-1', role: Role.STAFF })),
    ).resolves.toBe(true);
  });

  it('blocks STAFF who lacks the required permission', async () => {
    setUp(Permission.USERS_MANAGE);
    userRepository.findById.mockResolvedValue(
      makeStaffUser({ permissions: [Permission.PRODUCTS_VIEW] }),
    );

    await expect(
      guard.canActivate(makeContext({ sub: 'staff-1', role: Role.STAFF })),
    ).resolves.toBe(false);
  });

  it('rejects a deactivated STAFF user immediately, even mid-session', async () => {
    setUp(Permission.PRODUCTS_VIEW);
    userRepository.findById.mockResolvedValue(
      makeStaffUser({
        isActive: false,
        permissions: [Permission.PRODUCTS_VIEW],
      }),
    );

    await expect(
      guard.canActivate(makeContext({ sub: 'staff-1', role: Role.STAFF })),
    ).rejects.toThrow(UnauthorizedException);
  });
});
