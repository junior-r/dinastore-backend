import { NotFoundException } from '@nestjs/common';
import {
  OAuthProvider,
  Role,
  User,
} from '@/modules/users/domain/entities/user.entity';
import type {
  UserDetail,
  UserRepository,
} from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { GetUserDetailHandler } from './get-user-detail.handler';
import { GetUserDetailQuery } from './get-user-detail.query';

describe('GetUserDetailHandler', () => {
  let repository: jest.Mocked<UserRepository>;
  let handler: GetUserDetailHandler;

  beforeEach(() => {
    repository = createMockUserRepository();
    handler = new GetUserDetailHandler(repository);
  });

  it('returns the user detail, including linked OAuth accounts', async () => {
    const detail: UserDetail = {
      user: User.fromPersistence({
        id: 'user-1',
        email: 'jane@example.com',
        passwordHash: 'hash',
        name: 'Jane Doe',
        avatarUrl: null,
        role: Role.CUSTOMER,
        isActive: true,
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      oauthAccounts: [
        {
          provider: OAuthProvider.GOOGLE,
          providerAccountId: 'g-1',
          createdAt: new Date(),
        },
      ],
      hasPassword: true,
    };
    repository.findDetailById.mockResolvedValue(detail);

    const result = await handler.execute(new GetUserDetailQuery('user-1'));

    expect(result).toBe(detail);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    repository.findDetailById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetUserDetailQuery('missing')),
    ).rejects.toThrow(NotFoundException);
  });
});
