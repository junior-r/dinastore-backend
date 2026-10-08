import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { User } from '@/modules/users/domain/entities/user.entity';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { GetUserByIdQuery } from './get-user-by-id.query';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler implements IQueryHandler<
  GetUserByIdQuery,
  User
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async execute(query: GetUserByIdQuery): Promise<User> {
    const user = await this.userRepository.findById(query.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
