import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainError } from '@/shared/domain/domain-error';
import { User } from '@/modules/users/domain/entities/user.entity';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { UpdateUserRoleCommand } from './update-user-role.command';

@CommandHandler(UpdateUserRoleCommand)
export class UpdateUserRoleHandler implements ICommandHandler<
  UpdateUserRoleCommand,
  User
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async execute(command: UpdateUserRoleCommand): Promise<User> {
    // Prevents an admin from accidentally locking the site out of admin
    // access by demoting themselves with no one else around to undo it.
    if (command.actingUserId === command.targetUserId) {
      throw new DomainError('You cannot change your own role');
    }

    const user = await this.userRepository.findById(command.targetUserId);
    if (!user) {
      throw new NotFoundException(`User "${command.targetUserId}" not found`);
    }

    return this.userRepository.update(user.changeRole(command.role));
  }
}
