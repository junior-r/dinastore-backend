import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DomainError } from '@/shared/domain/domain-error';
import { Permission } from '@/modules/users/domain/entities/permission';
import { User } from '@/modules/users/domain/entities/user.entity';
import { USER_REPOSITORY } from '@/modules/users/domain/repositories/user.repository';
import type { UserRepository } from '@/modules/users/domain/repositories/user.repository';
import { UpdateUserPermissionsCommand } from './update-user-permissions.command';

const VALID_PERMISSIONS = new Set<string>(Object.values(Permission));

@CommandHandler(UpdateUserPermissionsCommand)
export class UpdateUserPermissionsHandler implements ICommandHandler<
  UpdateUserPermissionsCommand,
  User
> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
  ) {}

  async execute(command: UpdateUserPermissionsCommand): Promise<User> {
    const invalid = command.permissions.filter(
      (p) => !VALID_PERMISSIONS.has(p),
    );
    if (invalid.length > 0) {
      throw new DomainError(`Unknown permission(s): ${invalid.join(', ')}`);
    }

    const user = await this.userRepository.findById(command.targetUserId);
    if (!user) {
      throw new NotFoundException(`User "${command.targetUserId}" not found`);
    }

    return this.userRepository.update(user.setPermissions(command.permissions));
  }
}
