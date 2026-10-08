import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '@/modules/users/domain/entities/user.entity';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { ActivateUserCommand } from './activate-user.command';

@CommandHandler(ActivateUserCommand)
export class ActivateUserHandler implements ICommandHandler<
  ActivateUserCommand,
  User
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async execute(command: ActivateUserCommand): Promise<User> {
    const user = await this.userRepository.findById(command.targetUserId);
    if (!user) {
      throw new NotFoundException(`User "${command.targetUserId}" not found`);
    }

    return this.userRepository.update(user.activate());
  }
}
