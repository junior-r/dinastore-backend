import { Role, User } from '@/modules/users/domain/entities/user.entity';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { createMockUserRepository } from '@/modules/users/testing/mock-user-repository';
import { GetUsersHandler } from './get-users.handler';
import { GetUsersQuery } from './get-users.query';

function makeUser(id: string): User {
  return User.fromPersistence({
    id,
    email: `${id}@example.com`,
    passwordHash: 'hash',
    name: id,
    avatarUrl: null,
    role: Role.CUSTOMER,
    isActive: true,
    permissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('GetUsersHandler', () => {
  let repository: jest.Mocked<UserRepository>;
  let handler: GetUsersHandler;

  beforeEach(() => {
    repository = createMockUserRepository();
    handler = new GetUsersHandler(repository);
  });

  it('paginates using skip/take derived from page and pageSize', async () => {
    const user = makeUser('user-1');
    repository.findMany.mockResolvedValue([user]);
    repository.count.mockResolvedValue(41);

    const result = await handler.execute(new GetUsersQuery('jane', 3, 20));

    expect(repository.findMany).toHaveBeenCalledWith({
      search: 'jane',
      skip: 40,
      take: 20,
    });
    expect(repository.count).toHaveBeenCalledWith({ search: 'jane' });
    expect(result).toEqual({ items: [user], total: 41, page: 3, pageSize: 20 });
  });

  it('defaults to page 1 and pageSize 20', async () => {
    repository.findMany.mockResolvedValue([]);
    repository.count.mockResolvedValue(0);

    await handler.execute(new GetUsersQuery());

    expect(repository.findMany).toHaveBeenCalledWith({
      search: undefined,
      skip: 0,
      take: 20,
    });
  });
});
