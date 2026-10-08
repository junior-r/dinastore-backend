import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '@/modules/users/domain/entities/user.entity';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { GetUsersQuery } from './get-users.query';

export interface PaginatedUsers {
  items: User[];
  total: number;
  page: number;
  pageSize: number;
}

@QueryHandler(GetUsersQuery)
export class GetUsersHandler implements IQueryHandler<
  GetUsersQuery,
  PaginatedUsers
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUsersQuery): Promise<PaginatedUsers> {
    const skip = (query.page - 1) * query.pageSize;
    const params = { search: query.search };

    const [items, total] = await Promise.all([
      this.userRepository.findMany({
        ...params,
        skip,
        take: query.pageSize,
      }),
      this.userRepository.count(params),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}
