import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type {
  UserDetail,
  UserRepository,
} from '@/modules/users/domain/repositories/user.repository';
import { GetUserDetailQuery } from './get-user-detail.query';

@QueryHandler(GetUserDetailQuery)
export class GetUserDetailHandler implements IQueryHandler<
  GetUserDetailQuery,
  UserDetail
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUserDetailQuery): Promise<UserDetail> {
    const detail = await this.userRepository.findDetailById(query.userId);
    if (!detail) {
      throw new NotFoundException(`User "${query.userId}" not found`);
    }
    return detail;
  }
}
